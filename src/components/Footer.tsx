export default function Footer() {
  return (
    <div className="px-4 py-6 bg-[#011A40] h-16 flex items-center">
      <div className="w-full flex items-center justify-center text-gray-300 text-sm space-x-20">
        {/* Social Icons */}
        <div className="flex items-center">
          <div
            className="w-8 h-8 bg-white rounded-full border border-gray-300 flex items-center justify-center"
            style={{ marginRight: '16px' }}
          >
            <svg className="w-4 h-4 text-orange-500" fill="currentColor" viewBox="0 0 24 24">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </div>
          <div
            className="w-8 h-8 bg-white rounded-full border border-gray-300 flex items-center justify-center"
            style={{ marginRight: '16px' }}
          >
            <svg className="w-4 h-4 text-orange-500" fill="currentColor" viewBox="0 0 24 24">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
          </div>
        </div>

        {/* All Text Elements Together */}
        <div className="flex items-center">
          <a
            href="#"
            className="hover:text-white transition-colors"
            style={{ marginRight: '32px' }}
          >
            Terms of Use
          </a>
          <a
            href="#"
            className="hover:text-white transition-colors"
            style={{ marginRight: '32px' }}
          >
            Documentation
          </a>
          <a
            href="#"
            className="hover:text-white transition-colors"
            style={{ marginRight: '32px' }}
          >
            FAQ
          </a>
          <span>Seipad Protocol 2025</span>
        </div>
      </div>
    </div>
  );
}
