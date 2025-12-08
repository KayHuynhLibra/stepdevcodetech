import Link from 'next/link';

// Minimal static landing page - không cần server hoặc animation
export default function SimplePage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-4xl mx-auto px-6 py-16 space-y-12">
        <header className="space-y-3">
          <p className="text-sm font-semibold text-emerald-300 uppercase tracking-wide">
            StepDevCode.Tech
          </p>
          <h1 className="text-4xl md:text-5xl font-bold">
            Portfolio đơn giản để kiểm tra deploy
          </h1>
          <p className="text-gray-400 max-w-2xl">
            Trang này không dùng animation hay API động, phù hợp để test build
            và deploy trên GitHub Pages hoặc bất kỳ static host nào.
          </p>
        </header>

        <section className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-lg">
            <h2 className="text-xl font-semibold mb-2">Nội dung chính</h2>
            <ul className="list-disc list-inside text-gray-300 space-y-1">
              <li>Giới thiệu ngắn gọn</li>
              <li>Liên kết tới trang tĩnh có hiệu ứng</li>
              <li>Liên kết tới phần động (nếu server chạy)</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-lg">
            <h2 className="text-xl font-semibold mb-2">Hướng dẫn nhanh</h2>
            <ol className="list-decimal list-inside text-gray-300 space-y-1">
              <li>Chạy <code>npm run build:static</code> cho GitHub Pages.</li>
              <li>Deploy thư mục <code>out/</code> lên Pages.</li>
              <li>Dùng Vercel nếu cần tính năng động.</li>
            </ol>
          </div>
        </section>

        <section className="flex flex-wrap gap-3">
          <Link
            href="/static"
            className="px-5 py-3 rounded-full bg-emerald-500 text-slate-950 font-semibold hover:bg-emerald-400 transition"
          >
            Xem trang tĩnh (có hiệu ứng)
          </Link>
          <Link
            href="/habit"
            className="px-5 py-3 rounded-full border border-white/20 text-white font-semibold hover:bg-white/10 transition"
          >
            Đi tới phần động (server)
          </Link>
          <Link
            href="/"
            className="px-5 py-3 rounded-full text-gray-300 hover:text-white transition"
          >
            Về trang chính
          </Link>
        </section>
      </div>
    </main>
  );
}

