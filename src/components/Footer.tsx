export default function Footer() {
  return (
    <footer className="py-24 px-6 md:px-24 bg-femme-pale border-t border-femme-plum/10">
      <div className="grid md:grid-cols-3 gap-16 items-start">
        <div className="flex flex-col gap-4">
          <h2 className="text-4xl text-femme-plum">Femme Events</h2>
          <p className="text-xs opacity-60">Made with love in Atlanta.</p>
        </div>

        <div className="flex flex-col gap-6">
          <h4 className="text-xs uppercase tracking-[0.2em] font-bold opacity-40">Location</h4>
          <div className="text-sm leading-relaxed">
            123 Kitschy Lane<br />
            Atlanta, GA 30301
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <h4 className="text-xs uppercase tracking-[0.2em] font-bold opacity-40">Contact</h4>
          <div className="text-sm leading-relaxed">
            amanda@femmeevents.com<br />
            (678) 644-5257
          </div>
        </div>
      </div>
      
      <div className="mt-24 pt-8 border-t border-femme-plum/5 flex justify-between items-center text-[10px] uppercase tracking-widest font-bold opacity-30">
        <span>&copy; 2024 Femme Events</span>
        <span>All Rights Reserved</span>
      </div>
    </footer>
  );
}
