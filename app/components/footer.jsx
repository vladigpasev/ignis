// components/Footer.jsx
export default function Footer() {
  return (
    <footer className="w-full bg-[#697077] text-white py-6">
      <div className="w-full mx-auto px-4 flex justify-center items-center">
        <p className="text-[20px]">
          CompanyName © {new Date().getFullYear()}. All rights reserved.
        </p>
      </div>
    </footer>
  );
}