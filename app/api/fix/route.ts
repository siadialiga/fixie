import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(req: Request) {
    try {
        const { repoUrl, force } = await req.json();

        // parse github url
        const match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
        if (!match) {
            return NextResponse.json({ error: "Invalid GitHub URL" }, { status: 400 });
        }

        // check if job already exists
        const existingJob = await prisma.job.findFirst({
            where: { repoUrl }
        });

        if (existingJob) {
            if (force) {
                // reset existing job in queue
                const job = await prisma.job.update({
                    where: { id: existingJob.id },
                    data: {
                        status: "PENDING",
                        message: null,
                        prUrl: null,
                        fixedCount: 0,
                        updatedAt: new Date()
                    }
                });
                return NextResponse.json({ message: "Job added to queue! It will be processed shortly.", jobId: job.id });
            }

            return NextResponse.json({
                alreadyExists: true,
                message: "This repository has already been processed.",
                jobId: existingJob.id,
                status: existingJob.status,
                prUrl: existingJob.prUrl
            });
        }
        
        // add job to database queue
        const job = await prisma.job.create({
            data: {
                repoUrl,
                status: "PENDING"
            }
        });

        return NextResponse.json({ message: "Job added to queue! It will be processed shortly.", jobId: job.id });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "An error occurred while queueing the job.";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}