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
  let currentPage = 1; // Trang hiện tại
  let perPage = 10; // Số dòng mỗi trang

  async function loadDataFromTable(tableName) {
    window.currentTable = tableName;
    const { data, error } = await supabase
      .from(tableName)
      .select("*")
      .order("ma", { ascending: true });

    if (error) {
      document.getElementById(
        "rsvpTableBody"
      ).innerHTML = `<tr><td colspan="4">⚠️ Lỗi tải dữ liệu từ ${tableName}</td></tr>`;
      console.error(error.message);
      return;
    }

    allThemes = data;
    renderData(allThemes);
    renderTableCards(allThemes);
    updateTableSelectOptions(allThemes, 10); // 10 người mỗi bàn
  }

  function renderData(data) {
    const tbody = document.getElementById("rsvpTableBody");
    tbody.innerHTML = "";

    const start = (currentPage - 1) * perPage;
    const end = start + perPage;
    const pageData = data.slice(start, end);

    const maxPeoplePerTable = 10;
    const totalTables = Math.ceil(data.length / maxPeoplePerTable);

    // 🔢 Đếm số người ở mỗi bàn
    const tableCounts = {};
    data.forEach((item) => {
      if (!item.table_number || item.table_number === 0) return;
      const attend = parseInt(item.attend_person) || 0;
      const total = 1 + attend;
      tableCounts[item.table_number] =
        (tableCounts[item.table_number] || 0) + total;
    });

    pageData.forEach((item, index) => {
      const tr = document.createElement("tr");

      // 🔧 Tạo option bàn hợp lệ
      const tableOptions = Array.from({ length: totalTables }, (_, i) => {
        const tableNum = i + 1;
        const isCurrent = item.table_number == tableNum;
        const count = tableCounts[tableNum] || 0;

        // Chỉ cho hiển thị bàn còn chỗ hoặc là bàn hiện tại của khách
        if (count < maxPeoplePerTable || isCurrent) {
          const selected = isCurrent ? "selected" : "";
          return `<option value="${tableNum}" ${selected}>Bàn ${tableNum} (${count}/10)</option>`;
        } else {
          return ""; // Bỏ qua bàn đầy
        }
      }).join("");

      tr.innerHTML = `
      <td class="p-2 text-center">${start + index + 1}</td>
      <td class="p-2 text-center">${item.ten} (${item.ma})</td>
      <td class="p-2 text-center">${item.group_name}</td>
      <td class="p-2 text-center">
        <select class="w-full border rounded px-3 py-2 table-select" data-id="${
          item.ma
        }">
          <option value="0"${
            item.table_number == 0 ? " selected" : ""
          }>Chưa chọn</option>
          ${tableOptions}
        </select>
      </td>
      <td class="p-2 align-middle bg-transparent border-b-0 whitespace-nowrap shadow-transparent text-center adminOnly">
        <a href="#" class="edit-link">✏️ Sửa</a>
        <a href="#" class="delete-link">🗑️ Xoá</a>
      </td>
    `;

      tbody.appendChild(tr);

      // Sự kiện click sửa/xoá
      tr.querySelector(".edit-link").addEventListener("click", (e) => {
        e.preventDefault();
        editUser(item.ma);
      });

      tr.querySelector(".delete-link").addEventListener("click", (e) => {
        e.preventDefault();
        deleteEntry(item.ma, item.ten || "(Không tên)");
      });

      // Sự kiện thay đổi bàn
      const select = tr.querySelector(".table-select");
      select.addEventListener("change", async function () {
        const selectedValue = parseInt(this.value);
        const guestId = this.getAttribute("data-id");

        const { error } = await supabase
          .from(currentTable)
          .update({ table_number: selectedValue })
          .eq("ma", guestId);

        if (error) {
          alert("❌ Lỗi khi lưu bàn!");
          console.error(error);
        } else {
          const { data: updatedData, error: fetchError } = await supabase
            .from(currentTable)
            .select("*");

          if (fetchError) {
            alert("❌ Lỗi khi tải lại dữ liệu!");
            console.error(fetchError);
            return;
          }

          allThemes = updatedData;
          await loadDataFromTable(window.currentTable);
        }
      });
    });

    renderPagination();

    document.querySelectorAll(".adminOnly").forEach((el) => {
      el.style.display = user2?.role === 0 ? "table-cell" : "none";
    });
  }

  function renderPagination() {
    const paginationContainer = document.getElementById("pagination");
    paginationContainer.innerHTML = "";

    const totalPages = Math.ceil(allThemes.length / perPage);

    for (let i = 1; i <= totalPages; i++) {
      const btn = document.createElement("button");
      btn.className =
        "mx-1 px-2 py-1 rounded " +
        (i === currentPage ? "bg-blue-500 text-white" : "bg-gray-200");
      btn.innerText = i;
      btn.onclick = function () {
        currentPage = i;
        renderData(allThemes);
        renderTableCards(allThemes);
        updateTableSelectOptions(allThemes, 10); // 10 người mỗi bàn
      };
      paginationContainer.appendChild(btn);
    }
  }

  // ✅ Event xoá
  window.deleteEntry = async function (ma, name) {
    if (!confirm("Bạn có chắc muốn xoá " + name + " không?")) return;

    console.log("Đang xoá:", ma, "từ bảng:", window.currentTable);

    const { error } = await supabase
      .from(window.currentTable)
      .delete()
      .eq("ma", ma);

    if (error) {
      alert("❌ Xoá thất bại: " + error.message);
      return;
    }

    await loadDataFromTable(window.currentTable);
  };

  // ✅ Admin
  if (user2?.role === 0) {
    const select = document.getElementById("tableSelector");
    const { data, error } = await supabase.rpc("list_guest_tables");

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
    }

    select.addEventListener("change", async (e) => {
      const selectedTable = e.target.value;
      await loadDataFromTable(selectedTable);
    });
  } else {
    // ✅ Người dùng thường
    const table = `guests_${user.username}`;
    await loadDataFromTable(table);
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

    const fileName = `${currentTable}_guests_export.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  window.importExcel = async function () {
    const fileInput = document.getElementById("excelFile");
    if (!fileInput.files.length) {
      alert("Hãy chọn file Excel!");
      return;
    }

    const file = fileInput.files[0];
    const reader = new FileReader();

    reader.onload = async function (e) {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: "array" });

      // Lấy sheet đầu tiên
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      // Convert sheet → JSON
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      console.log("Excel data:", jsonData);

      // Gửi dữ liệu lên Supabase
      const { data: inserted, error } = await supabase
        .from(window.currentTable)
        .insert(jsonData);

      if (error) {
        console.error("Import lỗi:", error);
        alert("Có lỗi khi import!");
      } else {
        console.log("Đã import:", inserted);
        alert("Import thành công!");
        await loadDataFromTable(window.currentTable);
      }
    };

    reader.readAsArrayBuffer(file);
  };

  window.editUser = function (ma) {
    const user = allThemes.find((u) => u.ma === ma);
    if (!user) return alert("Không tìm thấy user");

    document.getElementById("editMa").value = user.ma;
    document.getElementById("editName").value = user.ten;
    document.getElementById("editAttendPerson").value = user.attend_person;
    document.getElementById("editGroup").value = user.group_name;

    updateTableSelectOptions(allThemes, 10, user); // 👈 thêm dòng này

    document.getElementById("editTable").value = String(user.table_number || 0);
    document.getElementById("editPopupOverlay").style.display = "flex";
  };

  window.saveEdit = async function () {
    const ma = document.getElementById("editMa").value;
    const ten = document.getElementById("editName").value.trim();
    const group_name = document.getElementById("editGroup").value;
    const table_number = document.getElementById("editTable").value;
    const attend_person = document.getElementById("editAttendPerson").value;

    const { error } = await supabase
      .from(window.currentTable)
      .update({ ma, ten, group_name, table_number, attend_person })
      .eq("ma", ma);

    if (error) {
      alert("❌ Lỗi khi cập nhật: " + error.message);
      return;
    }

    closePopup();
    await loadDataFromTable(window.currentTable);
  };

  function renderTableCards(data) {
    const container = document.getElementById("tableCardGrid");
    container.innerHTML = "";

    const tables = {};

    data.forEach((guest) => {
      const tableNum = guest.table_number || "Chưa phân";
      if (!tables[tableNum]) tables[tableNum] = [];
      tables[tableNum].push(guest);
    });

    Object.keys(tables).forEach((tableNum) => {
      const guests = tables[tableNum];

      // ✅ Tính tổng số người ngồi bàn này
      const totalPeople = guests.reduce(
        (sum, g) => sum + 1 + (parseInt(g.attend_person) || 0),
        0
      );

      const maxPeople = 10; // 🎯 Bạn có thể thay đổi giới hạn ở đây
      const isOverLimit = totalPeople > maxPeople;

      // ✅ Cảnh báo nếu vượt quá
      const warningHTML = isOverLimit
        ? `<span class="text-red-600 font-bold ml-2">⚠️ Quá ${
            totalPeople - maxPeople
          } người!</span>`
        : "";

      const card = document.createElement("div");
      card.className = "w-full px-3 mt-0 lg:w-1/3 lg:flex-none";
      card.style.marginBottom = "20px";

      card.innerHTML = `
      <div class="shadow-xl relative z-20 flex min-w-0 flex-col break-words rounded-2xl bg-white">
        <div class="p-6 pb-0 mb-0">
          <div class="flex items-center justify-between flex-wrap">
            <h6 class="dark:text-white text-base font-semibold">
              🪑 Bàn ${tableNum} ${warningHTML}
            </h6>
          </div>
        </div>

        <div class="flex-auto px-0 pt-0 pb-2">
          <div class="p-0 overflow-x-auto">
            <ul style="max-height: 240px;" class="overflow-y-auto pr-2 custom-scroll list-disc pl-6 text-sm leading-6 text-gray-800 space-y-1">
              ${guests
                .map(
                  (g) => `
                    <li>
                      <span class="font-medium">${g.ten}</span>
                      <span class="text-gray-500">(${
                        g.group_name || "Không rõ"
                      })</span>
                      <span class="text-gray-500" style="color:red;"><b>(${
                        parseInt(g.attend_person) || 0
                      })</b></span>
                    </li>
                  `
                )
                .join("")}
            </ul>
          </div>
        </div>
      </div>
    `;

      container.appendChild(card);
    });
  }

  function updateTableSelectOptions(
    guestList,
    maxPeoplePerTable = 10,
    currentGuest = null
  ) {
    const tableCount = {};

    guestList.forEach((guest) => {
      const table = parseInt(guest.table_number);
      if (!table || isNaN(table)) return;

      const attend = parseInt(guest.attend_person) || 0;
      const totalPeople = 1 + attend;

      tableCount[table] = (tableCount[table] || 0) + totalPeople;
    });

    const select = document.getElementById("editTable");
    select.innerHTML = '<option value="0">Chưa chọn</option>';

    const maxTableNumber = Math.max(
      ...Object.keys(tableCount).map(Number),
      Math.ceil(guestList.length / maxPeoplePerTable)
    );

    for (let i = 1; i <= maxTableNumber; i++) {
      const currentCount = tableCount[i] || 0;

      // Kiểm tra nếu bàn này đầy nhưng là bàn của người đang sửa
      const isCurrentGuestTable =
        currentGuest && parseInt(currentGuest.table_number) === i;

      if (currentCount >= maxPeoplePerTable && !isCurrentGuestTable) continue;

      const option = document.createElement("option");
      option.value = i;
      option.textContent = `Bàn ${i} (${currentCount}/${maxPeoplePerTable})`;

      // Chọn bàn đang dùng
      if (isCurrentGuestTable) {
        option.selected = true;
      }

      select.appendChild(option);
    }
  }

  window.closePopup = function () {
    document.getElementById("editPopupOverlay").style.display = "none";
  };

  window.loadData = async function () {
    await loadDataFromTable(window.currentTable);
  };
})();
