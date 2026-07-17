(() => {
    const workbook = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQBLZIJPYNytp-jLWo-jgdO14Ih2mwM4NoC7e2WSV5qpXlO5EhJe7AfI1oaY701iJuoJWF7-Qud_OSL/pub";
    const tabs = [
        ["Overview", "0"],
        ["Model Library", "413637993"],
        ["Writing & Reasoning", "943818819"],
        ["Stability Tests", "274494934"],
        ["8K Roblox portal", "209729008"]
    ].map(([name, gid], index) => ({
        id: `benchmark-${index}`,
        name,
        url: `${workbook}?gid=${gid}&single=true&output=csv`
    }));

    const controls = document.querySelector("[data-benchmark-tabs]");
    const output = document.querySelector("[data-benchmark-output]");
    const filter = document.querySelector("#benchmark-filter");
    const resultsCount = document.querySelector("[data-results-count]");
    if (!controls || !output || !filter || !resultsCount) return;

    const cache = new Map();
    let currentRows = [];
    let sortColumn = -1;
    let sortDirection = 1;

    function parseCSV(text) {
        const rows = [];
        let row = [], cell = "", quoted = false;
        for (let i = 0; i < text.length; i += 1) {
            const char = text[i], next = text[i + 1];
            if (char === '"' && quoted && next === '"') { cell += '"'; i += 1; }
            else if (char === '"') quoted = !quoted;
            else if (char === "," && !quoted) { row.push(cell); cell = ""; }
            else if ((char === "\n" || char === "\r") && !quoted) {
                if (char === "\r" && next === "\n") i += 1;
                row.push(cell);
                if (row.some((value) => value.trim() !== "")) rows.push(row);
                row = []; cell = "";
            } else cell += char;
        }
        if (cell.length || row.length) { row.push(cell); rows.push(row); }
        return rows;
    }

    function compareValues(left, right) {
        const a = (left || "").trim(), b = (right || "").trim();
        const an = Number(a.replace(/[,%]/g, "")), bn = Number(b.replace(/[,%]/g, ""));
        if (a && b && Number.isFinite(an) && Number.isFinite(bn)) return an - bn;
        return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
    }

    function filteredRows() {
        if (currentRows.length < 2) return currentRows;
        const query = filter.value.trim().toLocaleLowerCase();
        let body = currentRows.slice(1);
        if (query) body = body.filter((row) => row.some((value) => value.toLocaleLowerCase().includes(query)));
        if (sortColumn >= 0) {
            body = [...body].sort((a, b) => sortDirection * compareValues(a[sortColumn], b[sortColumn]));
        }
        return [currentRows[0], ...body];
    }

    function renderTable() {
        const rows = filteredRows();
        if (currentRows.length < 2) {
            output.innerHTML = '<div class="error"><strong>No data found.</strong> The published sheet returned no table rows.</div>';
            resultsCount.textContent = "0 rows";
            return;
        }
        const rowCount = Math.max(0, rows.length - 1);
        resultsCount.textContent = `${rowCount} of ${currentRows.length - 1} rows`;
        if (!rowCount) {
            output.innerHTML = '<div class="empty-table">No rows match this filter. Try a shorter or different search.</div>';
            return;
        }

        const table = document.createElement("table");
        table.className = "benchmark-table";
        const thead = document.createElement("thead"), headRow = document.createElement("tr");
        rows[0].forEach((label, column) => {
            const th = document.createElement("th");
            const button = document.createElement("button");
            button.type = "button";
            button.className = "sort-button";
            const active = column === sortColumn;
            button.textContent = `${label || "Unnamed column"}${active ? (sortDirection > 0 ? " ↑" : " ↓") : " ↕"}`;
            button.setAttribute("aria-label", `Sort by ${label || "unnamed column"}${active ? (sortDirection > 0 ? ", ascending" : ", descending") : ""}`);
            button.addEventListener("click", () => {
                if (sortColumn === column) sortDirection *= -1;
                else { sortColumn = column; sortDirection = 1; }
                renderTable();
            });
            th.append(button); headRow.append(th);
        });
        thead.append(headRow); table.append(thead);

        const tbody = document.createElement("tbody");
        rows.slice(1).forEach((values) => {
            const tr = document.createElement("tr");
            rows[0].forEach((_, index) => {
                const value = values[index]?.trim() || "";
                const td = document.createElement("td");
                if (!value) {
                    td.textContent = "Not reported";
                    td.className = "mono";
                } else if (value.length > 80) {
                    td.className = "cell-long";
                    const text = document.createElement("div");
                    text.className = "cell-scroll";
                    text.textContent = value;
                    const copy = document.createElement("button");
                    copy.type = "button";
                    copy.className = "copy-button";
                    copy.textContent = "Copy";
                    copy.addEventListener("click", async () => {
                        try {
                            await navigator.clipboard.writeText(value);
                            copy.textContent = "Copied";
                            setTimeout(() => { copy.textContent = "Copy"; }, 1300);
                        } catch { copy.textContent = "Select text"; }
                    });
                    td.append(text, copy);
                } else td.textContent = value;
                tr.append(td);
            });
            tbody.append(tr);
        });
        table.append(tbody);
        const wrap = document.createElement("div");
        wrap.className = "table-window";
        wrap.id = "benchmark-table-panel";
        wrap.tabIndex = 0;
        wrap.setAttribute("aria-label", "Scrollable benchmark table");
        wrap.append(table);
        output.replaceChildren(wrap);
    }

    async function select(tab, button) {
        controls.querySelectorAll("button").forEach((item) => {
            const selected = item === button;
            item.classList.toggle("active", selected);
            item.setAttribute("aria-selected", String(selected));
            item.tabIndex = selected ? 0 : -1;
        });
        output.innerHTML = '<div class="loading mono">Fetching published benchmark data…</div>';
        resultsCount.textContent = "";
        filter.disabled = true;
        filter.value = "";
        sortColumn = -1;
        try {
            let rows = cache.get(tab.id);
            if (!rows) {
                const response = await fetch(tab.url);
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                rows = parseCSV(await response.text());
                cache.set(tab.id, rows);
            }
            currentRows = rows;
            filter.disabled = false;
            renderTable();
        } catch {
            currentRows = [];
            output.replaceChildren();
            const error = document.createElement("div");
            error.className = "error";
            error.innerHTML = "<strong>Live data could not be loaded.</strong><br>Check your connection or ";
            const link = document.createElement("a");
            link.href = tab.url;
            link.target = "_blank";
            link.rel = "noopener";
            link.textContent = "open the published CSV directly";
            error.append(link, ".");
            output.append(error);
            resultsCount.textContent = "Data unavailable";
        }
    }

    filter.addEventListener("input", renderTable);
    controls.addEventListener("keydown", (event) => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
        const buttons = [...controls.querySelectorAll("button")];
        const current = buttons.indexOf(document.activeElement);
        let next = current;
        if (event.key === "ArrowLeft") next = (current - 1 + buttons.length) % buttons.length;
        if (event.key === "ArrowRight") next = (current + 1) % buttons.length;
        if (event.key === "Home") next = 0;
        if (event.key === "End") next = buttons.length - 1;
        event.preventDefault();
        buttons[next]?.focus();
        buttons[next]?.click();
    });

    tabs.forEach((tab, index) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `tab-button${index === 0 ? " active" : ""}`;
        button.textContent = tab.name;
        button.setAttribute("role", "tab");
        button.setAttribute("aria-selected", String(index === 0));
        button.setAttribute("aria-controls", "benchmark-table-panel");
        button.tabIndex = index === 0 ? 0 : -1;
        button.addEventListener("click", () => select(tab, button));
        controls.append(button);
        if (index === 0) select(tab, button);
    });
})();
