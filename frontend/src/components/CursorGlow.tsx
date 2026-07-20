import { useEffect, useRef } from "react";

export default function CursorGlow() {
    const glowRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const finePointer = window.matchMedia("(hover: hover) and (pointer: fine) and (min-width: 768px)");
        const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
        if (!finePointer.matches || reducedMotion.matches) return;

        let frame = 0;
        const handlePointerMove = (event: PointerEvent) => {
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(() => {
                if (glowRef.current) {
                    glowRef.current.style.transform = `translate3d(${event.clientX - 160}px, ${event.clientY - 160}px, 0)`;
                    glowRef.current.style.opacity = "1";
                }
            });
        };
        window.addEventListener("pointermove", handlePointerMove, { passive: true });
        return () => {
            cancelAnimationFrame(frame);
            window.removeEventListener("pointermove", handlePointerMove);
        };
    }, []);

    return <div ref={glowRef} aria-hidden="true" className="cursor-glow" />;
}
