export default function Hero() {
  return (
    <main className="flex justify-center bg-[#F7F9FC] min-h-screen px-4 sm:px-6 lg:px-8">
      {/* Wrapper with max width */}
      <section className="max-w-[1280px] w-full flex flex-col lg:flex-row items-center py-12 sm:py-20">
        {/* Left side - shape */}
        <div className="flex-1 flex justify-center mb-8 lg:mb-0">
          <div className="w-[280px] h-[280px] sm:w-[400px] sm:h-[400px] lg:w-[500px] lg:h-[500px] bg-[#E4E7EC] rounded-[50%_50%_50%_50%/60%_40%_60%_40%]" />
        </div>

        {/* Spacer between sections */}
        <div className="hidden lg:block w-[80px]" />

        {/* Right side - content */}
        <div className="flex-1 text-center lg:text-left px-2 sm:px-4">
          <p className="text-blue-700 font-semibold text-xs sm:text-sm uppercase mb-2">
            I am
          </p>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900">
            Lorem Ipsum
          </h1>
          <h2 className="text-xl sm:text-2xl lg:text-3xl font-semibold text-gray-900 mb-4">
            Lorem Ipsum is simply dummy
          </h2>
          <p className="text-gray-600 text-sm sm:text-base max-w-md mb-6 mx-auto lg:mx-0">
            Lorem Ipsum is simply dummy text of the printing and typesetting industry. 
            Lorem Ipsum has been the industry's standard dummy text ever since the 1500s
          </p>
          <button className="bg-blue-600 text-white px-5 sm:px-6 py-2 sm:py-3 rounded-md hover:bg-blue-700 transition">
            Contact Me
          </button>
        </div>
      </section>
    </main>
  );
}
