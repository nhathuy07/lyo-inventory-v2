<script lang="ts">
    // @ts-ignore
    import { lazyLoadScript } from "./lazyLoadScript";
    import {
        Modal,
        Field,
        Text,
        Select,
        Segmented,
        Button,
        // @ts-ignore
    } from "wx-svelte-core";
    // @ts-ignore
    import { Grid } from "wx-svelte-grid";
    import ImageCell from "./ImageCell.svelte";
    import { onMount } from "svelte";
    import { normalizeToEnglish, type VariantListing } from "./Template";
    import { imageToArrayBuffer } from "./imageToByteArray";

    let { shown = $bindable(), data, locations, selected_location_id } = $props();
    let filtered = $state(filterData(data));
    let filtered_shown: VariantListing[] = $state([]);
    let rowCount = $state(filtered.length);
    const count = filtered.length;
    const columns = [
        {
            id: "id",
            hidden: true,
        },
        {
            id: "sku",
            header: "SKU",
            resize: true,
            width: 100,
        },
        {
            id: "name",
            header: "Tên sản phẩm",
            width: 250,
            resize: true,
        },
        {
            id: "image_path",
            hidden: true,
        },
        {
            id: "image",
            header: "Ảnh",
            cell: ImageCell,
            width: 160,
        },
        {
            id: "c_on_hand",
            header: "Tồn kho",
            width: 100,
        },
    ];

    const responsive_cols = {
        500: {
            columns: [
                {
                    id: "id",
                    hidden: true,
                },
                {
                    id: "sku",
                    header: "SKU",
                    resize: true,
                    width: 100,
                },
                {
                    id: "name",
                    header: "Tên sản phẩm",
                    width: 200,
                    resize: true,
                },
                {
                    id: "image_path",
                    hidden: true,
                },
                {
                    id: "image",
                    hidden: true,
                    header: "Ảnh",
                    cell: ImageCell,
                    width: 160,
                },
                {
                    id: "c_on_hand",
                    header: "Tồn kho",
                    width: 100,
                },
            ],
        },
    };

    const fields = [
        {
            id: "sku",
            label: "SKU",
        },
        {
            id: "name_normalized",
            label: "Tên sản phẩm",
        },
        {
            id: "c_on_hand",
            label: "Tồn kho",
        },
    ];

    // @ts-ignore
    let api: any;

    function filterData(src: VariantListing[]) {
        return src.filter((v) => {
            // @ts-ignore
            return v.c_on_hand < 20;
        });
    }

    function filterDataByKeyword(src: VariantListing[], keyword: string) {
        return src.filter((v) => {
            if (!keyword) {
                // @ts-ignore
                return v.c_on_hand < 20;
            } else {
                return (
                    // @ts-ignore
                    v.c_on_hand < 20 &&
                    (v.sku.toLowerCase().includes(keyword.toLowerCase()) ||
                        v.name_normalized.includes(
                            normalizeToEnglish(keyword).toLowerCase(),
                        ))
                );
            }
        });
    }

    let debounce_timer: number | undefined = undefined;
    let keyword = $state("");
    let update_key = $state(0);

    function handleSortBarUpdate() {
        filtered = handleSorting(filtered);
        rowCount = filtered.length;
        update_key++;
    }

    function handleSearchBarUpdate() {
        if (debounce_timer) {
            clearTimeout(debounce_timer);
        }
        debounce_timer = window.setTimeout(() => {
            filtered = filterDataByKeyword(data, keyword);
            filtered = handleSorting(filtered);
            // console.log(filtered)
            // rowCount = 0
            rowCount = filtered.length;
            update_key++;
        }, 200);
    }

    let sort_dir = $state(-1);
    let sort_criteria = $state("c_on_hand");
    function handleSorting(data: VariantListing[]) {
        if (!sort_criteria) {
            return data;
        }
        // console.log(sort_dir, sort_criteria)
        return data.sort((a, b) => {
            const cmp_a = a[sort_criteria as keyof VariantListing];
            const cmp_b = b[sort_criteria as keyof VariantListing];

            if (typeof cmp_a === "number" && typeof cmp_b === "number") {
                return sort_dir === 1 ? cmp_a - cmp_b : cmp_b - cmp_a;
            }
            if (typeof cmp_a === "string" && typeof cmp_b === "string") {
                return sort_dir === 1
                    ? cmp_a.localeCompare(cmp_b)
                    : cmp_b.localeCompare(cmp_a);
            }
            return 0; // fallback for other types or undefined
        });
        update_key++;
    }

    let wwidth = $state(window.innerWidth);
    function handleResize() {
        // @ts-ignore

        if (innerWidth < 555) {
            api.exec("resize-column", {
                id: "name",
                width: Math.min(900, window.innerWidth) - 210,
            });
            return;
        }

        api.exec("resize-column", {
            id: "name",
            width: Math.min(900, window.innerWidth) - 370,
        });

        wwidth = window.innerWidth;
    }

    function requestData(ev: any) {
        const { row } = ev;
        if (row) {

            filtered_shown = filtered.slice(row.start, row.end + 10);
        }
    }

    let is_loading = false
    async function exportToXLSX() {
        const _ = await Promise.all([
            lazyLoadScript(
                "https://cdnjs.cloudflare.com/ajax/libs/FileSaver.js/2.0.0/FileSaver.min.js",
                "sha512-csNcFYJniKjJxRWRV1R7fvnXrycHP6qDR21mgz1ZP55xY5d+aHLfo9/FcGDQLfn2IfngbAHd8LdfsagcCqgTcQ==",
            ),
            lazyLoadScript(
                "https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js",
                "sha512-dlPw+ytv/6JyepmelABrgeYgHI0O+frEwgfnPdXDTOIZz+eDgfW07QXG02/O8COfivBdGNINy+Vex+lYmJ5rxw==",
            ),
        ]);
        is_loading = true;

        // @ts-ignore
        const wb = new ExcelJS.Workbook();
        const ws = wb.addWorksheet("Sheet1");

        let tbl_row = 4;
        const c_loc = locations.find((v) => v.id == selected_location_id);
        const time = new Date();

        const rows: any[] = [];
        filtered.forEach((v, _, __) => {
            rows.push([
                    v.sku,
                    v.name,
                    "",
                    v.restock_third,
                    v.restock_half,
                    v.restock,
                    v.c_on_hand,
                    v.c_incoming,
                    v.brand,
                    v.unit,
                    v.included_tax_import_price,
                    v.included_tax_price,
                    v.included_tax_price_ecomm,
                ]);
        });

        ws.getCell("A1").value = {
            richText: [
                { text: "Kho hàng: " },
                {
                    font: { bold: true },
                    text: `${c_loc?.label} - ${c_loc?.address}`,
                },
            ],
        };
        ws.getCell("A2").value = {
            richText: [
                { text: "Thống kê lúc: " },
                { font: { bold: true }, text: time.toLocaleString() },
            ],
        };

        let col_headers = [
            { name: "SKU", width: 17, filterButton: true },
            { name: "Tên sản phẩm", width: 50, filterButton: true },
            { name: "Ảnh", width: 20, filterButton: true },
            {
                name: "Số lượng đặt (= 1/3 SL bán)",
                width: 13,
                filterButton: true,
            },
            {
                name: "Số lượng đặt (= 1/2 SL bán)",
                width: 13,
                filterButton: true,
            },
            { name: "SL bán (1 tháng)", width: 16, filterButton: true },
            { name: "Tồn kho", width: 14, filterButton: true },
            { name: "Đang về", width: 14, filterButton: true },
            { name: "Nhãn hiệu", width: 14, filterButton: true },
            { name: "Đơn vị tính", width: 14, filterButton: true },
            { name: "Giá nhập", width: 14, filterButton: true },
            { name: "Thành tiền (Shop)", width: 14, filterButton: true },
            { name: "Thành tiền (TMĐT)", width: 14, filterButton: true },
        ];

        ws.columns = col_headers;

        // Define table

        ws.addTable({
            name: "Table",
            ref: `A${tbl_row}`,
            headerRow: true,
            columns: col_headers,
            rows: rows,
        });

        // Add image to cells
        let imgs: any[] = [];

        const img = new Image();
        for (const v of filtered) {
             let img_ext = v.image_path.split(".").pop();

                if (img_ext == "jpg") {
                    img_ext = "jpeg";
                }

                const imgData = await imageToArrayBuffer(v.image_path, 140);
                imgs.push([
                    wb.addImage({
                        buffer: imgData.b,
                        extension: img_ext,
                    }),
                    imgData.h,
                ]);
                console.log("fetched image")
        }

        imgs.forEach((v, i) => {
            if (v[0] != undefined) {
                ws.addImage(v[0], {
                    tl: { col: 2, row: tbl_row },
                    ext: { width: 140, height: v[1] },
                });
            }

            ws.getRow(tbl_row + 1).height = (v[1] + 10) * 0.75;
            tbl_row++;
        });

        for (let r = 3; r <= 4 + rows.length; r++) {
            const c_r = ws.getRow(r);

            if (c_r) {
                for (let c = 1; c <= col_headers.length; c++) {
                    const c_c = c_r.getCell(c);
                    if (c_c) {
                        c_c.alignment = { wrapText: true };
                    }
                }
            }
        }

        let buffer = await wb.xlsx.writeBuffer();
        let blob = new Blob([buffer], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });

        is_loading = false;
        // @ts-ignore
        saveAs(
            blob,
            `Kiểm hàng_${c_loc?.label.replace("W", "")}_${time.getDate()}-${time.getMonth() + 1}-${time.getFullYear()}.xlsx`,
        );
    }


    onMount(async () => {
        handleResize();
        // data = filterData(data)
        window.onresize = () => {  
            // @ts-ignore
            handleResize();
        };

        filtered = handleSorting(filtered)

    });
</script>

<Modal
    buttons={["ok"]}
    onconfirm={() => {
        shown = false;
    }}
>
    <div
        style="text-align: left; height: 600px; max-height: 600px; max-width: 900px; min-width: 100%"
    >
        <h2>Danh sách kiểm hàng</h2>


            <div style="display: flex; flex-direction: column; gap: 5px">
                <Text
                    bind:value={keyword}
                    onchange={handleSearchBarUpdate}
                    width="300"
                    icon="mdi mdi-magnify"
                    placeholder="Tìm kiếm tên sản phẩm, SKU"
                ></Text>

                <div style="display: flex; gap: 5px; max-width: 100%">
                <i class="mdi mdi-sort" style="display: flex; align-items: center; justify-content: center; vertical-align: center; font-size: 24px"></i>

                    <div style="width: calc(100% - 235px);">
                    <Select
                        onchange={handleSortBarUpdate}
                        bind:value={sort_criteria}
                        options={fields}
                        placeholder="Sắp xếp theo"
                    ></Select>
                    </div>

                    <Segmented
                        bind:value={sort_dir}
                        onchange={handleSortBarUpdate}
                        options={[
                            { id: 1, icon: "mdi mdi-arrow-up" },
                            {
                                id: -1,
                                icon: "mdi mdi-arrow-down",
                            },
                        ]}
                    ></Segmented>
                    <div style="margin-left: 5px;">
                    <Button icon="mdi mdi-download">Xuất</Button>

                    </div>
                </div>
            </div>

        <div style="height: 450px;">
            <p style="font-style: italic; margin-top: 0px">
                ({filtered.length} sản phẩm)
            </p>

            {#key update_key}
                <Grid
                    bind:this={api}
                    {columns}
                    data={filtered_shown}
                    dynamic={{ rowCount, columnCount: 4 }}
                    onrequestdata={requestData}
                    autoRowHeight
                    responsive={responsive_cols}
                    width="100%"
                    cellStyle={(row: any, col: { id: string }) =>
                        col.id == "c_on_hand" ? "highlightCell" : ""}
                ></Grid>
            {/key}
        </div>
    </div>
</Modal>

<style>
    :global(.highlightCell) {
        font-weight: bold;
        color: var(--wx-color-primary);
    }
</style>
