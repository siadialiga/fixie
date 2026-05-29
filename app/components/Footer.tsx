import React from 'react';

export default function Footer() {
    return (
        <footer className="absolute bottom-4 left-0 w-full z-20 text-neutral-600 text-xs text-center pointer-events-none">
            <div className="flex items-center justify-center gap-2 pointer-events-auto">
                <span>Fixie</span>
                <span>•</span>
                <span>Not affiliated with GitHub.</span>
                <span>•</span>
                <a
                    href="https://github.com/siadialiga/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-white transition"
                >
                    Batuhan Eroğlu
                </a>
                <span>•</span>
                <a
                    href="https://github.com/siadialiga/fixie"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-white transition"
                >
                    GitHub
                </a>
            </div>
        </footer>
    );
}
