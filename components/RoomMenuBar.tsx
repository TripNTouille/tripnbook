export default function RoomMenuBar() {
  return (
    <nav className="hidden md:block bg-black py-3 px-6">
      <ul className="flex items-center justify-center gap-8 text-white text-sm font-medium tracking-wide">
        <li className="hover:underline cursor-pointer">Chambres</li>
        <li className="hover:underline cursor-pointer">Suites</li>
        <li className="hover:underline cursor-pointer">Appartements</li>
      </ul>
    </nav>
  );
}
