export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] text-center space-y-8">
      <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-gray-900">
        Welcome to <span className="text-brand-600">TaradMooBann</span>
      </h1>
      <p className="text-lg sm:text-xl text-gray-600 max-w-2xl">
        Your local neighborhood online market. Order food, discover local shops, and get notified when your favorite vendors open.
      </p>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full mt-12">
        {/* Placeholder cards for features */}
        {['Browse Markets', 'Discover Shops', 'Place Orders', 'Get Notified'].map((feature, i) => (
          <div key={i} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
            <h3 className="font-semibold text-lg text-gray-800">{feature}</h3>
            <p className="text-gray-500 text-sm mt-2">Explore what your local community has to offer today.</p>
          </div>
        ))}
      </div>
    </div>
  );
}
