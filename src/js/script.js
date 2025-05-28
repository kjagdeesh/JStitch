function toggleSidebar() {
    document.getElementById("sidebar").classList.toggle("collapsed");
    document.getElementById("logo").classList.toggle("hidden");
    document.getElementById("TabLogo").classList.toggle("show");
}

function showSection(id, element = null) {
    const input = document.getElementById("jsonInput").value;
    if (input && input.trim() !== "" && processJSON()) {
        const sections = document.querySelectorAll(".content > div");
        sections.forEach(section => section.classList.add("hidden"));
        document.getElementById(id).classList.remove("hidden");

        const items = document.querySelectorAll(".menu-item");
        items.forEach(item => item.classList.remove("active"));
        if (element) {
            element.classList.add("active");
        }
    } 
    else if (id && id.trim() !== "input") 
    {
        try
        {
            const rawInput = input
            const cleanInput = rawInput.replace(/[\u00A0\u200B\u200C\u200D\uFEFF]/g, ''); // remove invisible/invalid unicode
            const jsonData = JSON.parse(cleanInput);
        } catch (e) {
            showPopup("Invalid JSON: " + e.message);
        }        
        // showPopup("Something went wrong while processing your JSON.\nPlease check your input and try again.")
    }
}

function processJSON() {
    const input = document.getElementById("jsonInput").value;
    try {
        const rawInput = input
        const cleanInput = rawInput.replace(/[\u00A0\u200B\u200C\u200D\uFEFF]/g, ''); // remove invisible/invalid unicode
        const jsonData = JSON.parse(cleanInput);

        // Render the collapsible JSON viewer
        const viewer = document.getElementById("jsonViewer");
        viewer.innerHTML = ""; // clear previous
        renderJSON(viewer, jsonData, "");

        // Other outputs

        const generated = generateFullCSharpModel(jsonData);

        document.getElementById("csharp-output").innerHTML = highlightCSharp(generated.trim());
        document.getElementById("jsonTree").innerHTML = buildTree(jsonData, "");
        visualizeJsonTreeGraph(jsonData, "json-graph");
        document.getElementById("formattedJson").innerHTML = beautifyJson(jsonData);
        document.getElementById("minifiedJson").innerHTML = minifyJson(jsonData);
        document.getElementById("table-container").innerHTML = "";
        document.getElementById("table-container").appendChild(generateJsonTable(jsonData));
        document.getElementById("sizeDetailsData").innerHTML = renderAggregatedJsonSizeChart(jsonData).innerHTML;

        // alert("JSON processed successfully!");
        return true;
    } catch (e) {
        // showPopup("Invalid JSON: " + e.message);
        return false;
    }
}

function beautifyJson(jsonData) {
    const container = document.createElement("div");
    container.className = "json-viewer-b";
    const pre = document.createElement("pre");
    pre.innerHTML = syntaxHighlight(jsonData);
    container.appendChild(pre);
    return container.innerHTML;
}

function minifyJson(jsonData) {
    const container = document.createElement("div");
    container.className = "json-viewer-b";
    // const pre = document.createElement("pre");
    container.innerHTML = syntaxHighlightMinified(jsonData);
    // container.appendChild(pre);
    return container.innerHTML;
}


function syntaxHighlight(json) {
    if (typeof json !== 'string') {
        json = JSON.stringify(json, null, 2);
    }

    json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return json.replace(
        /("(\\u[\da-fA-F]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
        function(match) {
            let cls = 'number';
            if (/^"/.test(match)) {
                if (/:$/.test(match)) {
                    cls = 'key';
                } else {
                    cls = 'string';
                }
            } else if (/true|false/.test(match)) {
                cls = 'boolean';
            } else if (/null/.test(match)) {
                cls = 'null';
            }
            return `<span class="${cls}">${match}</span>`;
        }
    );
}

function syntaxHighlightMinified(json) {
    json = JSON.stringify(json);
    json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return json.replace(
        /("(\\u[\da-fA-F]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
        function(match) {
            let cls = 'number';
            if (/^"/.test(match)) {
                if (/:$/.test(match)) {
                    cls = 'key';
                } else {
                    cls = 'string';
                }
            } else if (/true|false/.test(match)) {
                cls = 'boolean';
            } else if (/null/.test(match)) {
                cls = 'null';
            }
            return `<span class="${cls}">${match}</span>`;
        }
    );
}

function generateCSharpModel(obj, className = "Root", classMap = new Map()) {
    if (classMap.has(className)) return "";

    let result = `public class ${className} {\n`;

    for (let key in obj) {
        const value = obj[key];
        const propName = toPascalCase(key);
        let type = "string";

        if (typeof value === "number") {
            type = Number.isInteger(value) ? "int" : "double";
        } else if (typeof value === "boolean") {
            type = "bool";
        } else if (Array.isArray(value)) {
            if (value.length > 0) {
                const merged = mergeArrayItems(value);
                if (typeof merged === "object" && merged !== null) {
                    const subClassName = toPascalCase(key) + "Item";
                    type = `List<${subClassName}>`;
                    generateCSharpModel(merged, subClassName, classMap);
                } else {
                    type = `List<${typeof merged === "number" ? (Number.isInteger(merged) ? "int" : "double") :
                      typeof merged === "boolean" ? "bool" : "string"}>`;
                }
            } else {
                type = "List<object>";
            }
        } else if (typeof value === "object" && value !== null) {
            const subClassName = toPascalCase(key);
            type = subClassName;
            generateCSharpModel(value, subClassName, classMap);
        }

        result += `    public ${type} ${propName} { get; set; }\n`;
    }

    result += "}\n";
    classMap.set(className, result);
    return result;
}

function mergeArrayItems(arr) {
    const merged = {};
    for (const item of arr) {
        if (typeof item === "object" && item !== null) {
            for (const key in item) {
                if (!(key in merged)) merged[key] = item[key];
                else if (Array.isArray(merged[key]) && Array.isArray(item[key])) {
                    merged[key] = [...merged[key], ...item[key]];
                }
            }
        }
    }
    return merged;
}

function toPascalCase(str) {
    return str.replace(/[-_ ]+(\w)/g, (_, c) => c.toUpperCase()).replace(/^\w/, c => c.toUpperCase());
}

function generateFullCSharpModel(json) {
    const map = new Map();
    const rootObj = Array.isArray(json) ? mergeArrayItems(json) : json;
    generateCSharpModel(rootObj, "Root", map);
    return Array.from(map.values()).reverse().join("\n");
}

function highlightCSharp(code) {
    return code
        // Keywords
        .replace(/\b(public|class|get|set)\b/g, '<span class="token-keyword">$1</span>')

        // Generic types like List<SubType>
        .replace(/\b(List)<([^>]+)>/g, (_, list, subtype) =>
            `<span class="token-type">${list}</span><<span class="token-type">${subtype}</span>>`
        )

        // Primitive types
        .replace(/\b(int|double|bool|string|object)\b/g, '<span class="token-type">$1</span>')

        // Class names (e.g., Root, AddItem) after "class"
        .replace(/\bclass\s+([A-Z][a-zA-Z0-9_]*)/g, 'class <span class="token-class-name">$1</span>')

        // Property names before "{ get; set; }"
        .replace(/\b([A-Z][a-zA-Z0-9_]*)\s*{ get; set; }/g, '<span class="token-property">$1</span> { get; set; }')

        // Braces and semicolons
        .replace(/[{}]/g, m => `<span class="token-brace">${m}</span>`)
        .replace(/;/g, '<span class="token-semicolon">;</span>');
}

function copyCSharpModel() {
    const input = document.getElementById("jsonInput").value;
    const jsonData = JSON.parse(input);
    const code = generateFullCSharpModel(jsonData);
    navigator.clipboard.writeText(code)
        .then(() => {
            document.getElementById("copyIcon").classList.add("hidden");
            document.getElementById("copyStatus").classList.remove("hidden");

            setTimeout(() => {
                document.getElementById("copyStatus").classList.add("hidden");
                document.getElementById("copyIcon").classList.remove("hidden");
            }, 1500);
        })
        .catch(err => {
            console.error("Copy failed:", err);
        });
}

function copyJSONTree() {
    const treeContainer = document.getElementById("jsonTree");
    const textToCopy = treeContainer.innerText || treeContainer.textContent;
    navigator.clipboard.writeText(textToCopy)
        .then(() => {
            document.getElementById("copyIconJSONTree").classList.add("hidden");
            document.getElementById("copyStatusJSONTree").classList.remove("hidden");

            setTimeout(() => {
                document.getElementById("copyStatusJSONTree").classList.add("hidden");
                document.getElementById("copyIconJSONTree").classList.remove("hidden");
            }, 1500);
        })
        .catch(err => {
            console.error("Copy failed:", err);
        });
}

function copyJSONData() {
    const treeContainer = document.getElementById("formattedJson");
    const textToCopy = treeContainer.innerText || treeContainer.textContent;
    navigator.clipboard.writeText(textToCopy)
        .then(() => {
            document.getElementById("copyIconJSONData").classList.add("hidden");
            document.getElementById("copyStatusJSONData").classList.remove("hidden");

            setTimeout(() => {
                document.getElementById("copyStatusJSONData").classList.add("hidden");
                document.getElementById("copyIconJSONData").classList.remove("hidden");
            }, 1500);
        })
        .catch(err => {
            console.error("Copy failed:", err);
        });
}

function copyMinifiedJSONData() {
    const treeContainer = document.getElementById("minifiedJson");
    const textToCopy = treeContainer.innerText || treeContainer.textContent;
    navigator.clipboard.writeText(textToCopy)
        .then(() => {
            document.getElementById("copyIconJSONminified").classList.add("hidden");
            document.getElementById("copyStatusJSONminified").classList.remove("hidden");

            setTimeout(() => {
                document.getElementById("copyStatusJSONminified").classList.add("hidden");
                document.getElementById("copyIconJSONminified").classList.remove("hidden");
            }, 1500);
        })
        .catch(err => {
            console.error("Copy failed:", err);
        });
}

function copyJSONSize() {
    const treeContainer = document.getElementById("sizeDetailsData");
    const textToCopy = treeContainer.innerText || treeContainer.textContent;
    navigator.clipboard.writeText(textToCopy)
        .then(() => {
            document.getElementById("copyIconJSONSize").classList.add("hidden");
            document.getElementById("copyStatusJSONSize").classList.remove("hidden");

            setTimeout(() => {
                document.getElementById("copyStatusJSONSize").classList.add("hidden");
                document.getElementById("copyIconJSONSize").classList.remove("hidden");
            }, 1500);
        })
        .catch(err => {
            console.error("Copy failed:", err);
        });
}

function buildTree(obj, prefix = "") {
    let tree = "";
    const keys = Object.keys(obj);

    keys.forEach((key, index) => {
        const isLast = index === keys.length - 1;
        const branch = isLast ? "└── " : "├── ";
        const value = obj[key];

        //   tree += `<div class="tree-line"><span class="branch">${prefix}${branch}</span><span class="key">${key}</span>`;

        if (typeof value === "object" && value !== null) {
            tree += `<div class="tree-line"><span class="branch">${prefix}${branch}</span><span class="index">[${key}]</span>`;
        } else {
            tree += `<div class="tree-line"><span class="branch">${prefix}${branch}</span><span class="key">${key}</span>`;
        }


        if (typeof value === "object" && value !== null) {
            if (Array.isArray(value)) {
                tree += ` <span class="array-label">(Array)</span></div>`;
                value.forEach((item, i) => {
                    const isItemLast = i === value.length - 1;
                    const itemPrefix = prefix + (isLast ? "    " : "│   ");
                    const itemBranch = isItemLast ? "└── " : "├── ";

                    if (typeof item === "object" && item !== null) {
                        tree += `<div class="tree-line"><span class="branch">${itemPrefix}${itemBranch}</span><span class="index">[${i}]</span></div>`;
                        tree += buildTree(item, itemPrefix + (isItemLast ? "    " : "│   "));
                    } else {
                        tree += `<div class="tree-line"><span class="branch">${itemPrefix}${itemBranch}</span><span class="index">[${i}]: </span><span class="value">${item}</span></div>`;
                    }
                });
            } else {
                tree += `</div>`;
                tree += buildTree(value, prefix + (isLast ? "    " : "│   "));
            }
        } else {
            tree += `: <span class="value">${value}</span></div>`;
        }
    });

    return tree;
}


// JSON Viewer rendering functions

function renderJSON(container, data, rowId) {
    if (typeof data !== "object" || data === null) {
        container.appendChild(renderPrimitive(data));
        return;
    }

    if (Array.isArray(data)) {
        const wrapper = document.createElement("div");
        var collapsible = createCollapsible("Array[" + data.length + "]", "");
        if (String(rowId).trim() != "") {
            collapsible = createCollapsible(" " + rowId + ": Array[" + data.length + "]", "|--");
        }

        wrapper.appendChild(collapsible);

        const content = document.createElement("div");
        content.classList.add("json-item-parent");
        content.style.display = "none";

        data.forEach((item, index) => {
            const itemWrapper = document.createElement("div");
            itemWrapper.appendChild(renderJSONNode(index, item));
            content.appendChild(itemWrapper);
        });

        wrapper.appendChild(content);

        collapsible.onclick = () => {
            const expanded = collapsible.classList.toggle("expanded");
            content.style.display = expanded ? "block" : "none";
        };

        container.appendChild(wrapper);
    } else {
        // Object
        const wrapper = document.createElement("div");
        const keys = Object.keys(data);
        const collapsible = createCollapsible(" " + rowId + ": {" + keys.length + "}", "|-- |--");
        wrapper.appendChild(collapsible);

        const content = document.createElement("div");
        content.classList.add("json-item");
        content.style.display = "none";

        keys.forEach(key => {
            const itemWrapper = document.createElement("div");
            itemWrapper.appendChild(renderJSONNode(key, data[key]));
            content.appendChild(itemWrapper);
        });

        wrapper.appendChild(content);

        collapsible.onclick = () => {
            const expanded = collapsible.classList.toggle("expanded");
            content.style.display = expanded ? "block" : "none";
        };

        container.appendChild(wrapper);
    }
}

function renderJSONNode(key, value) {
    const node = document.createElement("span");

    if (typeof value === "object" && value !== null) {
        const keySpan = document.createElement("span");
        keySpan.textContent = key + ": ";
        keySpan.classList.add("json-key");

        const wrapper = document.createElement("div");
        // wrapper.appendChild(keySpan);

        // Render child object or array recursively
        renderJSON(wrapper, value, key);
        return wrapper;
    } else {
        const keySpan = document.createElement("span");

        const icon = document.createElement("i");
        icon.classList.add("fa-solid", "fa-arrow-turn-up", "small-margin"); // default to plus icon
        icon.style.marginRight = "8px";
        // icon.style.marginTop = "5px";
        icon.style.transform = "rotate(90deg)";
        icon.style.width = "15px";

        const icon2 = document.createElement("i");
        icon2.classList.add("fa-solid", "fa-diamond", "small-width"); // default to plus icon
        icon2.style.marginRight = "8px";
        icon2.style.width = "15px";

        // const icon = document.createElement("img");
        // icon.src = "https://icons.veryicon.com/png/o/miscellaneous/technology-brief/attribute-8.png"
        // icon.style.marginRight = "8px";
        // icon.style.width="10px";

        const label = document.createElement("span");
        label.textContent = key + ": ";

        keySpan.appendChild(icon);
        keySpan.appendChild(icon2);
        keySpan.appendChild(label)

        // keySpan.textContent = "|-- ▪" +key + ": ";
        keySpan.classList.add("json-key");

        const valueSpan = renderPrimitive(value);

        const line = document.createElement("span");
        line.appendChild(keySpan);
        line.appendChild(valueSpan);
        return line;
    }
}

function renderPrimitive(value) {
    const span = document.createElement("span");
    if (typeof value === "string") {
        span.textContent = `"${value}"`;
        span.classList.add("json-string");
    } else if (typeof value === "number") {
        span.textContent = value;
        span.classList.add("json-number");
    } else if (typeof value === "boolean") {
        span.textContent = value;
        span.classList.add("json-boolean");
    } else if (value === null) {
        span.textContent = "null";
        span.classList.add("json-null");
    } else {
        span.textContent = String(value);
    }
    return span;
}

function createCollapsible(text, requiredGuideLine) {
    const span = document.createElement("span");
    span.textContent = "";
    span.classList.add("collapsible");

    const icon = document.createElement("i");
    icon.classList.add("fa-regular", "fa-square-plus"); // default to plus icon
    icon.style.marginRight = "8px";

    const label = document.createElement("span");
    label.textContent = text;

    span.appendChild(icon);
    span.appendChild(label);

    span.addEventListener("click", () => {
        // span.classList.toggle("expanded");
        const isExpanded = span.classList.contains("expanded");
        icon.classList.toggle("fa-square-plus", isExpanded);
        icon.classList.toggle("fa-square-minus", !isExpanded);
    });


    return span;
}

// Show input section on initial load
document.addEventListener("DOMContentLoaded", () => {
    const menuItems = document.querySelectorAll(".menu-item");
    if (menuItems.length > 0) {
        showSection('input', menuItems[0]);
    }
});

function flattenObject(obj, prefix = '') {
    const entries = [];
    for (const [key, value] of Object.entries(obj)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        if (value && typeof value === 'object' && !Array.isArray(value)) {
            entries.push(...flattenObject(value, fullKey));
        } else if (Array.isArray(value)) {
            entries.push([fullKey, value.join(', ')]);
        } else {
            entries.push([fullKey, value]);
        }
    }
    return entries;
}

// function isArrayOfFlatObjects(data) {
//     return (
//         Array.isArray(data) &&
//         data.length > 0 &&
//         data.every(item =>
//             typeof item === 'object' &&
//             item !== null &&
//             !Array.isArray(item) &&
//             Object.values(item).every(v =>
//             typeof v !== 'object' || v === null || Array.isArray(v)
//             )
//         )
//     );
// }

function isSingleNestedObject(data) {
    return (
        typeof data === 'object' &&
        data !== null &&
        !Array.isArray(data)
    );
}


function generateJsonTable(jsonData) {

    if(isSingleNestedObject(jsonData)){
        const flatObj = Object.fromEntries(flattenObject(jsonData));
        jsonData = [flatObj]; 
    }

    const container = document.createElement("div");
    container.className = "table-wrapper";

    const allKeys = Array.from(
        new Set(jsonData.flatMap(obj => Object.keys(obj)))
    );

    const table = document.createElement("table");
    table.className = "json-table";
    table.id = "json-table-full";

    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");

    allKeys.forEach(key => {
        const th = document.createElement("th");
        const div = document.createElement("div");
        div.className = "th-content";

        const label = document.createElement("span");
        label.textContent = key;

        const input = document.createElement("input");
        input.type = "text";
        input.placeholder = `Filter ${key}`;
        input.className = "column-filter";
        input.oninput = () => filterTable(input);

        div.appendChild(label);
        div.appendChild(input);
        th.appendChild(div);
        headerRow.appendChild(th);
    });

    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");

    jsonData.forEach(obj => {
        const row = document.createElement("tr");
        allKeys.forEach(key => {
            const td = document.createElement("td");
            if (!(key in obj)) {
                td.textContent = "❌";
                td.className = "missing";
            } else {
                const val = obj[key];
                if (typeof val === "object" && val !== null) {
                    td.innerHTML = generateNestedTable(val).outerHTML;
                } else {
                    td.textContent = val;
                }
            }
            row.appendChild(td);
        });
        tbody.appendChild(row);
    });

    table.appendChild(tbody);
    container.appendChild(table);

    return container;
}

function clearAllFilters() {
    const container = document.getElementsByClassName("table-wrapper")[0];
    container.querySelectorAll(".column-filter").forEach(input => {
        input.value = "";
        filterTable(input);
    });
}

function generateNestedTable(obj) {
    const nestedTable = document.createElement("table");
    nestedTable.className = "nested-table";

    Object.entries(obj).forEach(([k, v]) => {
        const row = document.createElement("tr");
        const keyCell = document.createElement("th");
        keyCell.textContent = k;
        const valueCell = document.createElement("td");

        if (typeof v === "object" && v !== null) {
            valueCell.innerHTML = generateNestedTable(v).outerHTML;
        } else {
            valueCell.textContent = v;
        }

        row.appendChild(keyCell);
        row.appendChild(valueCell);
        nestedTable.appendChild(row);
    });

    return nestedTable;
}

function filterTable(input) {
    const filter = input.value.trim().toLowerCase();
    const th = input.closest("th");
    const columnIndex = Array.from(th.parentNode.children).indexOf(th);
    const table = input.closest("table");
    const rows = table.querySelectorAll("tbody tr");

    rows.forEach(row => {
        const cell = row.children[columnIndex];

        // If missing, treat as empty
        if (!cell || cell.classList.contains("missing")) {
            row.style.display = filter === "" ? "" : "none";
            return;
        }

        // Extract only direct text (exclude nested tables)
        let cellText = "";
        for (const node of cell.childNodes) {
            if (node.nodeType === Node.TEXT_NODE) {
                cellText += node.textContent;
            }
        }

        const match = cellText.toLowerCase().includes(filter);
        row.style.display = match ? "" : "none";
    });
}



function exportToCSV() {
    const table = document.getElementById("json-table-full");
    const rows = Array.from(table.querySelectorAll("tr"))
        .filter(row => row.style.display !== "none");

    const csv = rows
        .map(row =>
            Array.from(row.children)
            .map(cell => `"${cell.textContent.trim().replace(/"/g, '""')}"`)
            .join(",")
        )
        .join("\n");

    const blob = new Blob([csv], {
        type: "text/csv"
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "table_data.csv";
    a.click();
    URL.revokeObjectURL(url);
}

function renderAggregatedJsonSizeChart(jsonData) {
    const encoder = new TextEncoder();
    const fullJsonString = JSON.stringify(jsonData, null, 2); // includes whitespace
    const totalSizeBytes = encoder.encode(fullJsonString).length;
    const totalSizeKB = totalSizeBytes / 1024;

    const sizeMap = new Map();

    function measurePropertySize(obj, path = "") {
        if (Array.isArray(obj)) {
            obj.forEach(item => measurePropertySize(item, path));
        } else if (obj && typeof obj === "object") {
            for (const key in obj) {
                const value = obj[key];
                const fullPath = path ? `${path}.${key}` : key;

                if (typeof value === "object" && value !== null) {
                    measurePropertySize(value, fullPath);
                } else {
                    // Create JSON string for this single property with formatting
                    const singlePropJson = JSON.stringify({
                        [key]: value
                    }, null, 2);
                    const byteLength = encoder.encode(singlePropJson).length;
                    sizeMap.set(fullPath, (sizeMap.get(fullPath) || 0) + byteLength);
                }
            }
        }
    }

    measurePropertySize(jsonData);

    const results = Array.from(sizeMap.entries())
        .map(([key, size]) => ({
            key,
            size: size / 1024
        })) // KB
        .sort((a, b) => b.size - a.size);

    // === HTML Output ===
    const container = document.createElement("div");
    container.className = "json-size-chart";

    const totalDisplay = document.createElement("div");
    totalDisplay.className = "total-size";
    totalDisplay.innerHTML = `
      <strong>Total JSON Size (Pretty Printed):</strong> ${totalSizeKB.toFixed(2)} KB<br/>
      <small style="font-style: italic;">Includes keys, values, special characters, and whitespace</small>
    `;
    container.appendChild(totalDisplay);

    const maxSize = Math.max(...results.map(r => r.size));

    results.forEach(({
        key,
        size
    }) => {
        const bar = document.createElement("div");
        bar.className = "bar-row";
        bar.innerHTML = `
        <div class="bar-label">${key}</div>
        <div class="bar">
          <div class="bar-fill" style="width: ${(size / maxSize) * 100}%">
            <span class="bar-value">${size.toFixed(2)} KB</span>
          </div>
        </div>
      `;
        container.appendChild(bar);
    });

    return container;
}

let treeRoot = null;
let svg, gNode, gLink, tree, diagonal, dx = 30,
    dy = 180,
    i = 0;

function visualizeJsonTreeGraph(jsonData, containerId = "json-graph") {
    // Clear previous render
    const container = document.getElementById(containerId);
    container.innerHTML = "";

    treeRoot = d3.hierarchy(formatData(jsonData), d => d.children);
    treeRoot.x0 = 0;
    treeRoot.y0 = 0;

    i = 0;

    tree = d3.tree().nodeSize([dx, dy]);
    diagonal = d3.linkHorizontal().x(d => d.y).y(d => d.x);

    svg = d3.select(`#${containerId}`)
        .append("svg")
        .attr("viewBox", [-dy / 2, -dx * 2, 1000, dx * 20])
        .style("font", "13px 'Segoe UI', sans-serif")
        .style("user-select", "none")
        .style("background-color", "#1e1e1e");

    gLink = svg.append("g").attr("class", "link-group");
    gNode = svg.append("g").attr("class", "node-group").attr("cursor", "pointer");

    // collapseAllInitial(treeRoot); // start collapsed except root

    update(treeRoot);
}

function collapseAllInitial(node) {
    if (node.children) {
        node._children = node.children;
        node._children.forEach(collapseAllInitial);
        node.children = null;
    }
}

function update(source) {
    const nodes = treeRoot.descendants().reverse();
    const links = treeRoot.links();

    tree(treeRoot);

    let left = treeRoot;
    let right = treeRoot;
    treeRoot.eachBefore(node => {
        if (node.x < left.x) left = node;
        if (node.x > right.x) right = node;
    });

    const height = right.x - left.x + dx * 2;
    // const width = 1000;
    const width = treeRoot.height * 200 + 300; // tune spacing


    svg.attr("viewBox", [-dy / 2, left.x - dx, width, height]);

    const node = gNode.selectAll("g").data(nodes, d => d.id || (d.id = ++i));

    const nodeEnter = node.enter().append("g")
        .attr("transform", d => `translate(${source.y0},${source.x0})`)
        .on("click", (event, d) => {
            if (d.children) {
                d._children = d.children;
                d.children = null;
            } else {
                d.children = d._children;
                d._children = null;
            }
            update(d);
        });

    nodeEnter.append("rect")
        .attr("x", -5).attr("y", -5)
        .attr("width", 10).attr("height", 10)
        .attr("transform", "rotate(45)")
        .attr("fill", d => d._children ? "#2d45c6" : "#2d45c6")
        .attr("stroke", "#fdfdfd")
        .attr("stroke-width", 1);

    nodeEnter.append("title")
        .text(d => d.data.full || d.data.name);

    nodeEnter.append("text")
        .attr("dy", "0.31em")
        .attr("x", d => d._children ? -12 : 12)
        .attr("text-anchor", d => d._children ? "end" : "start")
        .html(d => formatText(d.data.name))
        .style("fill", "#e0e0e0")
        // .style("word-wrap", "break-word")
        .style("font-weight", "normal");

    node.merge(nodeEnter)
        .transition().duration(500)
        .attr("transform", d => `translate(${d.y},${d.x})`);

    node.exit()
        .transition().duration(500)
        .attr("transform", d => `translate(${source.y},${source.x})`)
        .remove();

    const link = gLink.selectAll("path").data(links, d => d.target.id);

    link.enter().append("path")
        .attr("d", d => {
            const o = {
                x: source.x0,
                y: source.y0
            };
            return diagonal({
                source: o,
                target: o
            });
        })
        .attr("fill", "none")
        .attr("stroke", "#2d45c6")
        .attr("stroke-width", 1.6)
        .merge(link)
        .transition().duration(500)
        .attr("d", d => diagonal({
            source: d.source,
            target: d.target
        }));

    link.exit().transition().duration(500).remove();

    treeRoot.eachBefore(d => {
        d.x0 = d.x;
        d.y0 = d.y;
    });
}

function formatData(data, key = "root") {
    if (typeof data === "object" && data !== null) {
        const children = Array.isArray(data) ?
            data.map((item, index) => formatData(item, `[${index}]`)) :
            Object.entries(data).map(([k, v]) => formatData(v, k));
        return {
            name: key,
            full: key,
            children
        };
    } else {
        const valueStr = typeof data === "string" ? `"${data}"` : data;
        return {
            name: `${key}: ${valueStr}`,
            full: `${key}: ${valueStr}`
        };
    }
}

function formatText(text) {
    const [key, ...valueParts] = text.split(":");
    const value = valueParts.join(":").trim();
    if (!value) return key;
    return `${key}: ${value}`;
}

function expandAll() {
    treeRoot.each(d => {
        if (d._children) {
            d.children = d._children;
            d._children = null;
        }
    });
    update(treeRoot);
}

function collapseAll() {
    treeRoot.children.forEach(collapseAllInitial);
    update(treeRoot);
}

// DOWNLOAD SVG
function downloadSVG() {
    if (!svg) return showPopup("No SVG available");

    const serializer = new XMLSerializer();
    const svgNode = svg.node();

    let source = serializer.serializeToString(svgNode);
    // Add XML declaration
    source = '<?xml version="1.0" standalone="no"?>\r\n' + source;

    const url = URL.createObjectURL(new Blob([source], {
        type: "image/svg+xml;charset=utf-8"
    }));

    const link = document.createElement("a");
    link.href = url;
    link.download = "json-tree.svg";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// DOWNLOAD PNG
function downloadPNG() {
    if (!svg) return showPopup("No PNG available");

    const svgNode = svg.node();
    const serializer = new XMLSerializer();
    const source = serializer.serializeToString(svgNode);

    const image = new Image();
    const svgBlob = new Blob([source], {
        type: "image/svg+xml;charset=utf-8"
    });
    const url = URL.createObjectURL(svgBlob);

    image.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = svgNode.clientWidth || 1000;
        canvas.height = svgNode.clientHeight || 800;
        const context = canvas.getContext("2d");

        // Fill background black for dark theme
        context.fillStyle = "#4a5259";
        context.fillRect(0, 0, canvas.width, canvas.height);

        context.drawImage(image, 0, 0);

        URL.revokeObjectURL(url);

        canvas.toBlob(blob => {
            const link = document.createElement("a");
            link.download = "json-tree.png";
            link.href = URL.createObjectURL(blob);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        });
    };

    image.onerror = () => {
        showPopup("Failed to load SVG image for PNG conversion.");
        URL.revokeObjectURL(url);
    };

    image.src = url;
}


function showPopup(message) {
    const popup = document.getElementById("errorPopup");
    const messageEl = document.getElementById("popupMessage");

    messageEl.textContent = message || "Something went wrong while processing your JSON.\nPlease check your input and try again.";
    popup.style.display = "flex";
}

function closePopup() {
    document.getElementById("errorPopup").style.display = "none";
}