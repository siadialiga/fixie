import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { Octokit } from 'octokit';

async function isDeadLink(url: string) {
    try {
        const res = await fetch(url, {
            method: 'GET', // some sites block head requests
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            },
            signal: AbortSignal.timeout(5000),
        });

        return res.status >= 400;
    } catch {
        return true;
    }
}

async function getArchiveUrl(url: string) {
    try {
        const res = await fetch(`https://archive.org/wayback/available?url=${encodeURIComponent(url)}`);
        const data = await res.json();
        console.log("Archive.org result:", data);
        return data.archived_snapshots?.closest?.url || null;
    } catch {
        return null;
    }
}

export async function GET(req: Request) {
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}` && authHeader !== cronSecret) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // check if there is a pending job
    const job = await prisma.job.findFirst({
        where: { status: "PENDING" },
        orderBy: { createdAt: "asc" }
    });

    if (!job) {
        return NextResponse.json({ message: "No pending jobs in queue." });
    }

    // mark as processing
    await prisma.job.update({
        where: { id: job.id },
        data: { status: "PROCESSING" }
    });

    try {
        const botToken = process.env.GITHUB_BOT_TOKEN;
        if (!botToken) {
            throw new Error("GITHUB_BOT_TOKEN is not defined in .env");
        }

        const match = job.repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
        if (!match) throw new Error("Invalid GitHub URL");
        
        const owner = match[1];
        const repo = match[2].replace('.git', '');

        const octokit = new Octokit({ auth: botToken });

        // fork repository
        let forkOwner = owner;
        
        const botUser = await octokit.rest.users.getAuthenticated();
        const botUsername = botUser.data.login;

        if (owner !== botUsername) {
            console.log(`Forking ${owner}/${repo} to ${botUsername}...`);
            await octokit.rest.repos.createFork({ owner, repo });
            forkOwner = botUsername;
            
            // wait for fork to complete
            await new Promise(resolve => setTimeout(resolve, 5000));
        }

        const repoInfo = await octokit.rest.repos.get({ owner: forkOwner, repo });
        const branch = repoInfo.data.default_branch;
        const refData = await octokit.rest.git.getRef({ owner: forkOwner, repo, ref: `heads/${branch}` });
        const baseSha = refData.data.object.sha;

        const treeData = await octokit.rest.git.getTree({ owner: forkOwner, repo, tree_sha: baseSha, recursive: "1" });
        const mdFiles = treeData.data.tree.filter((f: { path?: string; type?: string }) => !!f.path?.endsWith('.md') && f.type === 'blob');

        const updates = [];
        let fixedCount = 0;

        for (const file of mdFiles) {
            const fileData = await octokit.rest.repos.getContent({ owner: forkOwner, repo, path: file.path as string });

            if (!('content' in fileData.data)) continue;

            const content = Buffer.from(fileData.data.content, 'base64').toString('utf-8');
            let newContent = content;
            let isModified = false;

            const linkRegex = /\[([^\]]+)\]\((https?:\/\/[^\s\)]+)\)/g;
            const matches = [...content.matchAll(linkRegex)];

            for (const m of matches) {
                const fullMatch = m[0];
                const text = m[1];
                const url = m[2];
                console.log("Checking:", url);
                
                // add cooldown
                await new Promise(resolve => setTimeout(resolve, 500));
                
                if (await isDeadLink(url)) {
                    const archiveUrl = await getArchiveUrl(url);
                    if (archiveUrl) {
                        newContent = newContent.replace(fullMatch, `[${text}](${archiveUrl})`);
                        isModified = true;
                        fixedCount++;
                    }
                }
            }

            if (isModified) {
                updates.push({ path: file.path, content: newContent });
            }
        }

        if (updates.length === 0) {
            await prisma.job.update({
                where: { id: job.id },
                data: { status: "COMPLETED", message: "No broken links found or no archive snapshot available.", fixedCount: 0 }
            });
            return NextResponse.json({ message: "Job completed with no links to fix." });
        }

        // create branch, commit, and pr
        const newBranchName = `fix-dead-links-${Date.now()}`;
        await octokit.rest.git.createRef({ owner: forkOwner, repo, ref: `refs/heads/${newBranchName}`, sha: baseSha });

        const newTree = await Promise.all(updates.map(async (u) => {
            const blob = await octokit.rest.git.createBlob({ owner: forkOwner, repo, content: u.content, encoding: "utf-8" });
            return { path: u.path, mode: "100644" as const, type: "blob" as const, sha: blob.data.sha };
        }));

        const createdTree = await octokit.rest.git.createTree({ owner: forkOwner, repo, base_tree: baseSha, tree: newTree });

        const commit = await octokit.rest.git.createCommit({
            owner: forkOwner, repo, message: "Automatic: Broken links replaced with archive.org versions.",
            tree: createdTree.data.sha, parents: [baseSha]
        });

        await octokit.rest.git.updateRef({ owner: forkOwner, repo, ref: `heads/${newBranchName}`, sha: commit.data.sha });

        const pr = await octokit.rest.pulls.create({
            owner,
            repo,
            title: "Fix Dead Links via Fixie",
            body: "This pull request was automatically generated by [Fixie](https://github.com/siadialiga/fixie), a dead link resolution bot created by [Batuhan Eroğlu](https://github.com/siadialiga).\n\nBroken hyperlinks in the project documentation were identified and automatically replaced with active archive snapshots from the Wayback Machine to maintain link integrity.",
            head: `${botUsername}:${newBranchName}`,
            base: repoInfo.data.parent?.default_branch || branch
        });

        await prisma.job.update({
            where: { id: job.id },
            data: { status: "COMPLETED", message: "Success!", fixedCount, prUrl: pr.data.html_url }
        });

        return NextResponse.json({ message: "Job completed successfully!", prUrl: pr.data.html_url, fixedCount });

    } catch (error: unknown) {
        console.error(error);
        const message = error instanceof Error ? error.message : "An error occurred during processing.";
        await prisma.job.update({
            where: { id: job.id },
            data: { status: "ERROR", message }
        });
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
