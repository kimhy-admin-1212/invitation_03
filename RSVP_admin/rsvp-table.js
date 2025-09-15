(async function () {
  const supabase = window.supabase.createClient(
    CONFIG.SUPABASE_URL,
    CONFIG.SUPABASE_KEY
  );

  const user = JSON.parse(localStorage.getItem("userInfo"));
  if (!user || !user.username) {
    window.location.href = "/RSVP_admin/login.html";
    return;
  }

  const user2 = user; // bạn đã có `user`, không cần parse lại

  window.currentTable = "";
  let allThemes = [];
  let rsvpChartInstance = null;

  async function loadDataFromTable(tableName) {
    window.currentTable = tableName;
    const { data, error } = await supabase
      .from(tableName)
      .select("*")
      .order("id", { ascending: false });

    if (error) {
      document.getElementById(
        "rsvpTableBody"
      ).innerHTML = `<tr><td colspan="4">⚠️ Lỗi tải dữ liệu từ ${tableName}</td></tr>`;
      console.error(error.message);
      return;
    }

    allThemes = data;
    renderData(allThemes);
  }

  async function loadChartFromTable(tableName) {
    const { data, error } = await supabase.from(tableName).select("*");
    if (error || !data) return;

    const countYes = data.filter((i) => i.confirmation == "1").length;
    const countNo = data.filter((i) => i.confirmation == "0").length;

    const ctx = document.getElementById("rsvpChart").getContext("2d");

    if (rsvpChartInstance) rsvpChartInstance.destroy();

    rsvpChartInstance = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: ["Có tham dự", "Không tham dự"],
        datasets: [
          {
            data: [countYes, countNo],
            backgroundColor: ["#4caf50", "#f44336"],
          },
        ],
      },
      options: { responsive: true },
    });
  }

  function renderData(data) {
    const tbody = document.getElementById("rsvpTableBody");
    tbody.innerHTML = "";

    data.forEach((item, index) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
      <td class="p-2 text-center">${index + 1}</td>
      <td class="p-2 text-left">
      ${item.name} ${item.note ? `(${item.note})` : ""}
      </td>
      <td class="p-2 text-center" style="font-weight: bold; color: ${
        item.confirmation == "1" ? "green" : "red"
      }">
        <i class="bi ${
          item.confirmation == "1" ? "bi-check-circle" : "bi-x-circle"
        }"></i>
      </td>
      <td class="p-2 text-center">
        <button 
          class="text-blue-500 underline text-xs" 
          onclick="showMessagePopup(${JSON.stringify(item).replace(
            /"/g,
            "&quot;"
          )})"
        >
          Mở chi tiết
        </button>
      </td>
      <td class="p-2 align-middle bg-transparent border-b-0 whitespace-nowrap shadow-transparent text-center adminOnly">
        <a class="text-xs font-semibold leading-tight dark:text-white dark:opacity-80 text-slate-400" href="#" onclick="deleteEntry(${
          item.id
        }, '${item.name.replace(/'/g, "\\'")}')">🗑️ Xoá</a>
      </td>
    `;
      tbody.appendChild(tr);
    });

    // 🔻 Gọi sau khi render xong
    document.querySelectorAll(".adminOnly").forEach((el) => {
      el.style.display = user2?.role === 0 ? "table-cell" : "none";
    });
  }

  // ✅ Event xoá
  window.deleteEntry = async function (id, name) {
    if (!confirm("Bạn có chắc muốn xoá " + name + " không?")) return;

    console.log("Đang xoá:", id, "từ bảng:", window.currentTable);

    const { error } = await supabase
      .from(window.currentTable)
      .delete()
      .eq("id", id);

    if (error) {
      alert("❌ Xoá thất bại: " + error.message);
      return;
    }

    await loadDataFromTable(window.currentTable);
    await loadChartFromTable(window.currentTable);
  };

  // ✅ Popup
  window.showMessagePopup = function (data) {
    // data bây giờ là object (ví dụ {name: "...", email: "...", message: "..."} )
    let html = `
    <p><b>Tên:</b> ${data.name || "Chưa có"}</p>
    <p><b>Note:</b> ${data.note || "Chưa có"}</p>
    <p><b>Xác nhận:</b> ${
      data.confirmation == "1" ? "CÓ THAM DỰ" : "KHÔNG THAM DỰ" || "Chưa có"
    }</p>
    <p><b>Message:</b><br>${(data.message || "").replace(/\n/g, "<br>")}</p>
  `;

    document.getElementById("popupContent").innerHTML = html;
    document.getElementById("messagePopup").style.display = "block";
  };
  window.closePopup = function () {
    document.getElementById("messagePopup").style.display = "none";
  };

  // ✅ Admin
  if (user2?.role === 0) {
    const select = document.getElementById("tableSelector");
    const { data, error } = await supabase.rpc("list_rsvp_tables");
    if (error) {
      console.error("❌ RPC:", error.message);
      return;
    }

    select.innerHTML = "";
    data.forEach((row) => {
      const option = document.createElement("option");
      option.value = row.name;
      option.textContent = row.name;
      select.appendChild(option);
    });

    if (data.length > 0) {
      await loadDataFromTable(data[0].name);
      await loadChartFromTable(data[0].name);
    }

    select.addEventListener("change", async (e) => {
      const selectedTable = e.target.value;
      await loadDataFromTable(selectedTable);
      await loadChartFromTable(selectedTable);
    });
  } else {
    // ✅ Người dùng thường
    const table = `rsvp_messages_${user.username}`;
    await loadDataFromTable(table);
    await loadChartFromTable(table);
  }

  // rsvp-table.js
  window.exportToExcel = async function () {
    if (!currentTable) return alert("❌ Không có bảng nào được chọn!");

    const { data, error } = await supabase.from(currentTable).select("*");

    if (error) {
      alert("❌ Lỗi lấy dữ liệu: " + error.message);
      return;
    }

    if (!data || data.length === 0) {
      alert("⚠️ Không có dữ liệu để xuất.");
      return;
    }

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, currentTable);

    const fileName = `${currentTable}_rsvp_export.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  window.loadData = async function () {
    await loadDataFromTable(window.currentTable);
  };

  window.loadDataAndChart = async function () {
    await loadChartFromTable(window.currentTable);
  };
})();
