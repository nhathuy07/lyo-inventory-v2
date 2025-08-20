<script lang="ts">
    // @ts-ignore
    import { Grid, Willow } from "wx-svelte-grid";
    // @ts-ignore
    import { Button, Select, Portal, Modal } from "wx-svelte-core";
    // @ts-ignore
    import { Locale } from "wx-svelte-core";
    import {
        calculate_restock_data,
        get_active_products,
        get_locations,
        fetch_order_record,
        type ProductV2,
        type OrderRecordV2,
        type TransferRecord,
        fetch_inventory_transfer,
        get_low_sales_skus,
    } from "./DataPipelineV2";
    import SelectionCheckboxCell from "./SelectionCheckboxCell.svelte";
    import ImageCell from "./ImageCell.svelte";
    import { vi } from "./Localization";
    import { onMount, setContext } from "svelte";
    import { type Filtering, type Location, type Sorting } from "./Template";
    import { applyAction } from "$app/forms";
    import { lazyLoadStylesheets } from "./lazyLoadScript";
    import LoadingThrobber from "./LoadingThrobber.svelte";
    import SettingsModal from "./SettingsModal.svelte";

    import { Axios } from "axios";
    import { goto } from "$app/navigation";
    import HeaderWithSortUi from "./HeaderWithSortUI.svelte";

    const columns = [
        {
            id: "id",
            hidden: true,
        },
        {
            id: "selected",
            cell: SelectionCheckboxCell,
            width: 36,
        },
        {
            id: "sku",
            resize: true,
            width: 130, // 90 + 40
            header: [
                {
                    cell: HeaderWithSortUi,
                    text: "SKU",
                },
            ],
        },
        {
            id: "name",
            resize: true,
            width: 240, // 200 + 40
            header: [
                {
                    cell: HeaderWithSortUi,
                    text: "Tên sản phẩm",
                },
            ],
        },
        {
            id: "image",
            header: "Ảnh",
            cell: ImageCell,
        },
        {
            id: "image_path",
            hidden: true,
        },
        {
            id: "c_restock_third",
            resize: true,
            width: 140, // 100 + 40
            header: [
                {
                    cell: HeaderWithSortUi,
                    text: "SL đặt\n(1/3 tháng)",
                },
            ],
        },
        {
            id: "c_restock_half",
            resize: true,
            width: 140, // 100 + 40
            header: [
                {
                    cell: HeaderWithSortUi,
                    text: "SL đặt\n(1/2 tháng)",
                },
            ],
        },
        {
            id: "c_restock",
            resize: true,
            width: 140, // 100 + 40
            header: [
                {
                    cell: HeaderWithSortUi,
                    text: "SL bán\n(1 tháng)",
                },
            ],
        },
        {
            id: "suppliers",
            resize: true,
            width: 160, // Add width for consistency (if needed)
            header: [
                {
                    cell: HeaderWithSortUi,
                    text: "NCC",
                },
            ],
        },
        {
            id: "c_on_hand",
            resize: true,
            width: 140, // 100 + 40
            header: [
                {
                    cell: HeaderWithSortUi,
                    text: "Tồn kho",
                },
            ],
        },
        {
            id: "c_incoming",
            resize: true,
            width: 140, // 100 + 40
            header: [
                {
                    cell: HeaderWithSortUi,
                    text: "Đang về",
                },
            ],
        },
        {
            id: "brand",
            resize: true,
            width: 180, // 140 + 40
            header: [
                {
                    cell: HeaderWithSortUi,
                    text: "Nhãn hiệu",
                },
            ],
        },
        {
            id: "unit",
            resize: true,
            width: 180, // 140 + 40
            header: [
                {
                    cell: HeaderWithSortUi,
                    text: "Đơn vị tính",
                },
            ],
        },
        {
            id: "import_price",
            resize: true,
            width: 180, // 140 + 40
            header: [
                {
                    cell: HeaderWithSortUi,
                    text: "Giá nhập",
                },
            ],
        },
        {
            id: "retail_price",
            resize: true,
            width: 180, // 140 + 40
            header: [
                {
                    cell: HeaderWithSortUi,
                    text: "Thành tiền (Shop)",
                },
            ],
        },
        {
            id: "retail_price_ecomm",
            resize: true,
            width: 180, // 140 + 40
            header: [
                {
                    cell: HeaderWithSortUi,
                    text: "Thành tiền (TMĐT)",
                },
            ],
        },
    ];

    const filter_by_id: Map<string, Filtering> = $state(new Map())
    const sort_by_id: Map<string, Sorting> = $state(new Map())

    setContext("filterbyid", filter_by_id)
    setContext("sortbyid", sort_by_id)

    const responsive_fields = {
        800: {
            columns: [
                {
                    id: "id",
                    hidden: true,
                },
                {
                    id: "selected",
                    cell: SelectionCheckboxCell,
                    width: 36,
                },
                {
                    id: "sku",
                    resize: true,
                    width: 130, // 90 + 40
                    header: [
                        {
                            cell: HeaderWithSortUi,
                            text: "SKU",
                        },
                    ],
                },
                {
                    id: "name",
                    resize: true,
                    width: 240, // 200 + 40
                    header: [
                        {
                            cell: HeaderWithSortUi,
                            text: "Tên sản phẩm",
                        },
                    ],
                },
                {
                    id: "image",
                    header: "Ảnh",
                    cell: ImageCell,
                },
                {
                    id: "image_path",
                    hidden: true,
                },
                {
                    id: "c_restock_third",
                    resize: true,
                    width: 140, // 100 + 40
                    header: [
                        {
                            cell: HeaderWithSortUi,
                            text: "SL đặt\n(1/3 tháng)",
                        },
                    ],
                },
                {
                    id: "c_restock_half",
                    resize: true,
                    width: 140, // 100 + 40
                    header: [
                        {
                            cell: HeaderWithSortUi,
                            text: "SL đặt\n(1/2 tháng)",
                        },
                    ],
                },
                {
                    id: "c_restock",
                    resize: true,
                    width: 140, // 100 + 40
                    header: [
                        {
                            cell: HeaderWithSortUi,
                            text: "SL bán\n(1 tháng)",
                        },
                    ],
                },
                {
                    id: "suppliers",
                    resize: true,
                    width: 140, // Add width for consistency (if needed)
                    header: [
                        {
                            cell: HeaderWithSortUi,
                            text: "NCC",
                        },
                    ],
                },
                {
                    id: "c_on_hand",
                    resize: true,
                    width: 140, // 100 + 40
                    header: [
                        {
                            cell: HeaderWithSortUi,
                            text: "Tồn kho",
                        },
                    ],
                },
                {
                    id: "c_incoming",
                    resize: true,
                    width: 140, // 100 + 40
                    header: [
                        {
                            cell: HeaderWithSortUi,
                            text: "Đang về",
                        },
                    ],
                },
                {
                    id: "brand",
                    resize: true,
                    width: 180, // 140 + 40
                    header: [
                        {
                            cell: HeaderWithSortUi,
                            text: "Nhãn hiệu",
                        },
                    ],
                },
                {
                    id: "unit",
                    resize: true,
                    width: 180, // 140 + 40
                    header: [
                        {
                            cell: HeaderWithSortUi,
                            text: "Đơn vị tính",
                        },
                    ],
                },
                {
                    id: "import_price",
                                        header: [
                        {
                            cell: HeaderWithSortUi,
                            text: "Giá nhập",
                        },
                    ],
                    resize: true,
                    width: 180, // 140 + 40
                },
                {
                    id: "retail_price",
                                        header: [
                        {
                            cell: HeaderWithSortUi,
                            text: "Thành tiền (Shop)",
                        },
                    ],
                    resize: true,
                    width: 180, // 140 + 40
                },
                {
                    id: "retail_price_ecomm",
                    header: [
                        {
                            cell: HeaderWithSortUi,
                            text: "Thành tiền (TMĐT)",
                        }],
                    resize: true,
                    width: 180, // 140 + 40
                },
            ],
        },
    };

    let data: ProductV2[] = $state([]);
    let is_loading = $state(false);
    let is_settings_open = $state(false);
    let updateKeys = $state({headerSorterKey: 0, dsource: []})
    setContext("updatekeys", updateKeys)

    let datasource: ProductV2[] = $state([]);
    // setContext("datasource", datasource);

    let variant_by_id = new Map<number, ProductV2>();
    let order_records: OrderRecordV2[] = [];
    let transfer_records: TransferRecord[] = [];
    let locations: Location[] = $state([]);

    let c_location_id: number = $state(-1);
    let rowCount = $state(0);
    let grid_key = $state(0);

    let selected_skus = $state(new Set<string>());
    let checkbox_update_key = $state({ k: 0 });
    setContext("selected_skus", selected_skus);
    setContext("checkbox_key", checkbox_update_key);
    let proxyUrl = "";
    let baseUrl = "";

    let low_sales_skus: Set<string> = $state(new Set<string>())

    if (import.meta.env.MODE === "development") {
        proxyUrl = "http://localhost:8080/api";
        baseUrl = "http://localhost:8080";
    } else {
        proxyUrl =
            "https://ninee35ef3e539b-inventory-mgmt-proxy.onrender.com/api";
        baseUrl = "https://ninee35ef3e539b-inventory-mgmt-proxy.onrender.com";
    }

    export function obtain_access_token() {
        if (sessionStorage.getItem("token") == null) {
            goto("/authentication");
        }
        return "Bearer " + sessionStorage.getItem("token");
    }

    let a = new Axios({
        headers: {
            "Content-Type": "application/json",
            Authorization: obtain_access_token(),
        },
    });

    async function dataProvider(ev: any) {
        const { row } = ev;
        if (row) {
            data = datasource.slice(row.start, row.end);
        }
    }

    let grid_api = $state();

    async function logout() {
        await a.delete(`${baseUrl}/revoke`);
        sessionStorage.clear();
        goto("/authentication");
    }

    function tweak_ui() {}

    function handle_location_update() {
        is_loading = true;

        datasource = calculate_restock_data(
            [...order_records, ...transfer_records],
            variant_by_id,
            c_location_id,
        );
        low_sales_skus = get_low_sales_skus(datasource)

        rowCount = datasource.length;
        grid_key++;

        is_loading = false;
    }

    async function initialize() {
        is_loading = true;

        locations = await get_locations();
        variant_by_id = await get_active_products();
        order_records = await fetch_order_record(variant_by_id);
        transfer_records = await fetch_inventory_transfer(variant_by_id);
        datasource = calculate_restock_data(
            [...order_records, ...transfer_records],
            variant_by_id,
            locations[0].id,
        );

        low_sales_skus = get_low_sales_skus(datasource)
        console.log("low", low_sales_skus)
        rowCount = datasource.length;
        c_location_id = locations[0].id;
        console.log(c_location_id);
        console.log(datasource);
        grid_key++;

        is_loading = false;
        // @ts-ignore
        updateKeys.dsource = datasource;
        updateKeys.headerSorterKey++;
    }

    onMount(async () => {
        lazyLoadStylesheets(
            "https://cdn.jsdelivr.net/npm/@mdi/font@7.4.47/css/materialdesignicons.min.css",
        );
        await initialize();
        tweak_ui();
    });
</script>

<Locale words={vi}>
    <Willow>

        <div style="display: flex; gap: 10px; padding-bottom: 10px">
            <Button onclick={initialize} type="primary" icon="mdi mdi-refresh"></Button>
            <div style="width: 200px">
                <Select
                    bind:value={c_location_id}
                    options={locations}
                    onchange={handle_location_update}
                    width="200"
                    placeholder="Chọn kho hàng..."
                ></Select>
            </div>
            <div>
                <Button>Chọn tất cả</Button>
                <Button>Bỏ chọn tất cả</Button>

                <Button icon="mdi mdi-package-variant-closed-check"
                    >Kiểm hàng</Button
                >
                <Button icon="mdi mdi-download">Xuất Excel</Button>
                <Button
                    icon="mdi mdi-cog"
                    onclick={() => {
                        is_settings_open = true;
                    }}
                ></Button>
                <Button icon="mdi mdi-logout" onclick={logout} type="danger"
                ></Button>
            </div>
        </div>
        
        {#if low_sales_skus.size}

        <div
            style="width: 100%; padding-left: 10px; background-color: #ffc748; margin-bottom: 10px; display: flex; align-items: center; gap: 10px; border-radius: 5px"
        >
            <p><b>{low_sales_skus.size}</b> mặt hàng có sản lượng thấp.</p>
            <div style="height: 32px;">
                <Button>Xem chi tiết</Button> 
            </div>
        </div>

        {/if}


        <div style="height: calc(100dvh - 110px);">
            {#key grid_key}
                <Grid
                autoRowHeight
                    bind:this={grid_api}
                    {columns}
                    {data}
                    responsive={responsive_fields}
                    onrequestdata={dataProvider}
                    dynamic={{ rowCount }}
                    sizes={{ rowHeight: 165 }}
                    rowStyle={(row: any) => (low_sales_skus.has(row.sku) && c_location_id === 122671 ? 'lowSales' : '')}
                />

                <style>
                    .lowSales {
                        background-color: #FF9248 !important
                    }
                </style>

            {/key}



        </div>

        {#if is_loading}
            <Portal>
                <Modal buttons={[]}>
                    <div
                        style="display:flex; flex-direction:column; align-items: center;"
                    >
                        <LoadingThrobber></LoadingThrobber>
                        <p style="margin-bottom: 0px;">Đang tải...</p>
                    </div>
                </Modal>
            </Portal>
        {/if}

        {#if is_settings_open}
            <Portal>
                <SettingsModal bind:shown={is_settings_open}></SettingsModal>
            </Portal>
        {/if}




    </Willow>
</Locale>
