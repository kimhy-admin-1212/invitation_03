const SUPABASE_URL = "https://quoniplztuaxcqncuirq.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF1b25pcGx6dHVheGNxbmN1aXJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAwNTYxNjgsImV4cCI6MjA2NTYzMjE2OH0.nw0p8kBuV_-FuqZ0LtY8FEGPIFLUhzlWgn31ZbRWS-4"; // dùng anon key, không dùng service_role ở client
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

async function kiemTra() {
  const ma = document.getElementById("ma").value.trim();
  const tb = document.getElementById("thongbao");

  try {
    const { data, error } = await supabaseClient
      .from("guests_giangthao")
      .select("*")
      .eq("ma", ma)
      .maybeSingle();

    if (error) {
      console.error("Lỗi khi truy vấn Supabase:", error);
      tb.textContent = "⚠️ Không thể kiểm tra do lỗi hệ thống.";
      return;
    }

    if (data) {
      window.location.href = `/giangthao/thiepmoi.html?ma=${encodeURIComponent(
        ma
      )}`;
    } else {
      window.location.href = `/giangthao/thiepmoi.html?ma=guest`;
    }
  } catch (error) {
    console.error("Lỗi ngoài ý muốn:", error);
    tb.textContent = "⚠️ Không thể kiểm tra do lỗi hệ thống.";
  }
}
