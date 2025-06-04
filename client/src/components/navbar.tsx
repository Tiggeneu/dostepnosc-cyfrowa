export default function Navbar() {
  return (
    <nav className="bg-white shadow-sm border-b">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          <a href="#" className="flex items-center space-x-2 text-xl font-bold text-blue-600">
            <span className="text-2xl">♿</span>
            <span>AccessiScan</span>
          </a>
          <div className="hidden md:flex space-x-8">
            <a href="#features" className="text-gray-600 hover:text-gray-800">Features</a>
            <a href="#documentation" className="text-gray-600 hover:text-gray-800">Docs</a>
            <a href="#about" className="text-gray-600 hover:text-gray-800">About</a>
          </div>
        </div>
      </div>
    </nav>
  );
}
