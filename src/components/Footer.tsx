export default function Footer() {
  return (
    <footer className="py-10 px-6 md:px-24 bg-femme-pale border-t border-femme-plum/10">
      <div className="grid md:grid-cols-3 gap-10 items-center">
        <div className="flex flex-col gap-2">
          <img
            src="/logo-footer.svg"
            alt="Femme Events"
            className="h-24 w-auto object-contain object-left"
          />
          <p className="text-sm opacity-60">Made with love in Atlanta.</p>
        </div>

        <div className="flex flex-col gap-2">
          <h4 className="text-sm uppercase tracking-[0.2em] font-bold opacity-40">Location</h4>
          <p className="text-base text-femme-dark/80">Serving Atlanta and surrounding areas</p>
        </div>

        <div className="flex flex-col gap-2">
          <h4 className="text-sm uppercase tracking-[0.2em] font-bold opacity-40">Contact</h4>
          <div className="text-base leading-relaxed">
            <a
              href="mailto:amanda@femmeevents.com"
              className="hover:text-femme-plum transition-colors duration-200 block"
            >
              amanda@femmeevents.com
            </a>
            <a
              href="tel:6786445257"
              className="hover:text-femme-plum transition-colors duration-200 block mt-1"
            >
              (678) 644-5257
            </a>
            <a
              href="https://instagram.com/_femmeevents"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-femme-plum transition-colors duration-200 block mt-1"
            >
              @_femmeevents
            </a>
          </div>
        </div>
      </div>

      <div className="mt-8 pt-6 border-t border-femme-plum/5 flex justify-between items-center text-xs uppercase tracking-widest font-bold opacity-30">
        <span>&copy; 2026 Femme Events</span>
        <span>All Rights Reserved</span>
      </div>
    </footer>
  );
}
