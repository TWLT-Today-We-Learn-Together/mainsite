(() => {
    const header = document.querySelector(".site-header");
    const toggle = document.querySelector(".nav-toggle");
    const nav = document.querySelector(".nav-links");

    document.documentElement.classList.add("nav-enhanced");
    document.querySelectorAll("[data-year]").forEach((el) => {
        el.textContent = new Date().getFullYear();
    });

    const closeMenu = () => {
        if (!toggle || !nav) return;
        nav.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
        toggle.setAttribute("aria-label", "Open navigation");
    };
    toggle?.addEventListener("click", () => {
        const open = !nav?.classList.contains("open");
        nav?.classList.toggle("open", open);
        toggle.setAttribute("aria-expanded", String(open));
        toggle.setAttribute("aria-label", open ? "Close navigation" : "Open navigation");
    });
    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            closeMenu();
            toggle?.focus();
        }
    });
    document.addEventListener("click", (event) => {
        if (header && !header.contains(event.target)) closeMenu();
    });
    matchMedia("(min-width: 921px)").addEventListener?.("change", closeMenu);

    const targets = document.querySelectorAll(".reveal");
    if (!("IntersectionObserver" in window) || matchMedia("(prefers-reduced-motion: reduce)").matches) {
        targets.forEach((el) => el.classList.add("visible"));
        return;
    }
    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add("visible");
            observer.unobserve(entry.target);
        });
    }, { threshold: 0.1 });
    targets.forEach((el) => observer.observe(el));
})();
