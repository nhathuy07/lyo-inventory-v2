<script lang="ts">
    import axios, { Axios } from "axios";
    import { onMount, setContext } from "svelte";

    // @ts-ignore

    // @ts-ignore
    import { Grid, Willow } from "wx-svelte-grid";
    // @ts-ignore
    import {
        Locale,
        Select,
        Field,
        Modal,
        Portal,
        Button,
        Segmented,
        TwoState,
        // @ts-ignore
    } from "wx-svelte-core";
    // @ts-ignore
    import {
        FilterBuilder,
        createArrayFilter,
        FilterEditor,
        // @ts-ignore
    } from "wx-svelte-filter";

    import {
        type VariantListing,
        type InventoryLevel,
        type VariantOrder,
        type VariantSold,
        type Location,
        normalizeToEnglish,
    } from "./Template";

    import SelectionCheckboxCell from "./SelectionCheckboxCell.svelte";
    import ImageCell from "./ImageCell.svelte";

    import { vi } from "./Localization";
    import { goto } from "$app/navigation";
    import LoadingThrobber from "./LoadingThrobber.svelte";
    import { lazyLoadScript, lazyLoadStylesheets } from "./lazyLoadScript";
    import SettingsModal from "./SettingsModal.svelte";
    import { toast_failure } from "./toast";
    import InventoryCheckupScreen from "./InventoryCheckupScreen.svelte";
    import { imageToArrayBuffer } from "./imageToByteArray";

    // import vi from "./Localization.svelte"
    // import Localization from "./Localization.svelte";
    // import {} from 'idb'

    let proxyUrl = "";
    let baseUrl = "";
    if (import.meta.env.MODE === "development") {
        proxyUrl = "http://localhost:8080/api";
        baseUrl = "http://localhost:8080";
    } else {
        proxyUrl =
            "https://ninee35ef3e539b-inventory-mgmt-proxy.onrender.com/api";
        baseUrl = "https://ninee35ef3e539b-inventory-mgmt-proxy.onrender.com";
    }
    let accessToken;
    let isAccountAdmin;
    let ignore_brand_ids = [2137491, 2079114, 2047739, 1986245];

    let a = new Axios({
        headers: {
            "Content-Type": "application/json",
            Authorization: obtain_access_token(),
            // "X-Sapo-Access-Token": accessToken,
        },
    });

    a.interceptors.response.use(
        function onFulfilled(response) {
            // Any status code that lie within the range of 2xx cause this function to trigger
            // Do something with response data
            return response;
        },
        function onRejected(error) {
            // Any status codes that falls outside the range of 2xx cause this function to trigger
            // Do something with response error

            handle_request_err(error);
            return Promise.reject(error);
        },
    );

    let indexed_db: IDBOpenDBRequest;

    // let raw_product_pages: string[] = [];
    // let raw_order_pages: string[] = [];

    // let variant_ids_empty_and_needs_restocking: string[] = [];
    // let current_date: Date = new Date()

    // Define interfaces

    function handle_request_err(err: any) {
        is_loading = false;

        toast_failure(`Lỗi khi xử lí yêu cầu: ${err}`);
        // alert(`Lỗi khi xử lí yêu cầu: ${err}`);

        // console.error("ERR", err);
    }

    async function fetchRawPagesFromProductsAPI() {
        // Probe the number of pages
        let p_incomplete = false;
        let first_page_resp = await a.get(`${proxyUrl}/admin/products.json`, {
            params: {
                page: 1,
                limit: 1,
            },
        });

        if (first_page_resp.status != 200) {
            handle_request_err(first_page_resp.statusText);
            p_incomplete = true;
            return { raw_product_pages: [], p_incomplete };
        }

        let batch_limit = 250;

        let first_page = JSON.parse(first_page_resp.data);
        let total_pages = Math.ceil(first_page.metadata.total / batch_limit);

        let raw_product_pages: string[] = [first_page_resp.data];

        // Batch-fetching products API, 3 at a time due to the 2 req/second ratelimit, each reqs taking ~600 ms to process
        for (let i = 1; i <= total_pages - 2; i += 3) {
            let x = await Promise.all([
                a.get(`${proxyUrl}/admin/products.json`, {
                    params: { page: i, limit: batch_limit },
                }),
                a.get(`${proxyUrl}/admin/products.json`, {
                    params: { page: i + 1, limit: batch_limit },
                }),
                a.get(`${proxyUrl}/admin/products.json`, {
                    params: { page: i + 2, limit: batch_limit },
                }),
                // a.get(`${baseUrl}/admin/products.json`, {params: {page: i+3, limit: batch_limit}}),
                // a.get(`${baseUrl}/admin/products.json`, {params: {page: i+4, limit: batch_limit}}),
            ]);

            for (let j = 0; j < x.length; j++) {
                if (x[j].status != 200) {
                    handle_request_err(x[j].statusText);
                    // return []
                    p_incomplete = true;
                } else {
                    raw_product_pages.push(x[j].data);
                }
            }
        }

        return { raw_product_pages, p_incomplete };
    }

    async function getActiveNonCompositeProducts(
        raw_product_pages: string[],
        inventory_id: "",
    ) {
        // let variants: VariantListing[] = [];

        let variants: Map<number, VariantListing> = new Map<
            number,
            VariantListing
        >();
        let items_need_tracing_back_by_loc_id: Map<
            number,
            Set<number>
        > = new Map<number, Set<number>>();

        raw_product_pages.forEach((raw_product_page) => {
            let products = JSON.parse(raw_product_page).products;

            products.forEach((product: any) => {
                product.variants.forEach((variant: any) => {
                    if (
                        variant.sellable &&
                        variant.status == "active" &&
                        variant.composite == false &&
                        !(variant.brand_id in ignore_brand_ids) &&
                        isNotPromotionalItem(product.brand)
                    ) {
                        // @ts-expect-error

                        let v: VariantListing = {};
                        v.sku = variant.sku || "<Không xác định>";
                        v.brand = product.brand || "<Không xác định>";
                        v.category = product.category || "<Không xác định>";
                        v.id = variant.id;
                        v.product_id = variant.product_id;
                        // v.variant_id = variant.variant_id;
                        v.name = variant.name || "<Không xác định>";
                        v.name_normalized = normalizeToEnglish(v.name);

                        v.suppliers = [];
                        v.tags = product.tags.split(",");
                        if (variant.unit) {
                            v.unit =
                                variant.unit.charAt(0).toUpperCase() +
                                variant.unit.slice(1).toLowerCase();
                        } else {
                            v.unit = "<Không xác định>";
                        }
                        v.variant_creation_date = null;
                        v.image_path = "";

                        v.inventory_levels_by_loc_id = new Map<
                            number,
                            InventoryLevel
                        >();

                        if (variant.images != null) {
                            if (variant.images.length != 0) {
                                v.image_path = variant.images[0].full_path;
                            }
                        }

                        if (v.image_path == "") {
                            if (
                                product.images != null &&
                                product.images.length != 0
                            ) {
                                v.image_path = product.images[0].full_path;
                            }
                        }

                        variant.inventories.forEach((inventory: any) => {
                            // // inventory.incoming can be less than 0, which signifies products being transferred out of the inventory
                            // if (inventory.incoming >= 0) {
                            //     v.incoming += inventory.incoming;
                            // } else {
                            //     v.outgoing += Math.abs(inventory.incoming);
                            // }

                            // v.on_hand += inventory.on_hand;
                            // v.available += inventory.available;
                            // v.onway += inventory.onway;

                            let incoming = 0;
                            let outgoing = 0;
                            if (inventory.incoming >= 0) {
                                incoming = inventory.incoming;
                            } else {
                                outgoing = Math.abs(inventory.incoming);
                            }

                            v.inventory_levels_by_loc_id.set(
                                inventory.location_id,
                                {
                                    incoming: incoming,
                                    outgoing: outgoing,
                                    on_hand: inventory.on_hand,
                                    available: inventory.available,
                                    onway: inventory.onway,
                                    restock: 0,
                                },
                            );

                            if (inventory.on_hand == 0) {
                                if (
                                    items_need_tracing_back_by_loc_id.has(
                                        inventory.location_id,
                                    )
                                ) {
                                    items_need_tracing_back_by_loc_id
                                        .get(inventory.location_id)
                                        ?.add(variant.id);
                                } else {
                                    items_need_tracing_back_by_loc_id.set(
                                        inventory.location_id,
                                        new Set(),
                                    );
                                    items_need_tracing_back_by_loc_id
                                        .get(inventory.location_id)
                                        ?.add(variant.id);
                                }
                            }
                        });

                        // Get different type of prices

                        variant.variant_prices.forEach((prices: any) => {
                            if (prices.name.toLowerCase() == "giá nhập") {
                                v.included_tax_import_price =
                                    prices.included_tax_price;
                            } else if (
                                prices.name.toLowerCase() == "giá shop"
                            ) {
                                v.included_tax_price =
                                    prices.included_tax_price;
                            } else if (prices.name.toLowerCase() == "tmđt") {
                                v.included_tax_price_ecomm =
                                    prices.included_tax_price;
                            }
                        });

                        // Add to list
                        variants.set(v.id, v);
                    }
                });
            });
        });

        return { variants, items_need_tracing_back_by_loc_id };
    }

    function isNotPromotionalItem(brand: string) {
        if (brand == null) {
            return true;
        }

        let br = brand.toLowerCase();

        if (br == "tặng" || br == "sale" || br == "combo") {
            return false;
        } else if (br.search("kđh") != -1) {
            return false;
        } else {
            return true;
        }
    }

    function getPastOrdersFromIndexedDB(
        time_start: Date,
        time_end: Date,
        out_of_stock_variant_ids: Map<number, Set<number>> = new Map<
            number,
            Set<number>
        >(),
    ): Promise<{
        sales_by_item: Map<number, VariantSold>;
        // variant_sales_by_id:

        last_order_time_ms: number;
    }> {
        return new Promise((resolve, reject) => {
            // let past_orders_record: VariantOrder[] = [];
            let sales_by_item: Map<number, VariantSold> = new Map<
                number,
                VariantSold
            >();
            let last_order_time_ms = time_start.getTime();
            let current_time = new Date();

            // let last_time_unix_ms = 0;

            const db_request = indexedDB.open("db", 1);

            db_request.onerror = (event) => {
                handle_request_err("Cannot connect to IndexedDB");
                return { past_orders_record: [], last_order_time_ms };
            };

            db_request.onsuccess = (event) => {
                // @ts-expect-error
                const db: IDBDatabase = event.target.result;

                const tx: IDBTransaction = db.transaction(
                    "past_orders",
                    "readonly",
                );
                const store = tx.objectStore("past_orders");

                const time_range = IDBKeyRange.bound(
                    time_start.getTime(),
                    time_end.getTime(),
                );

                const cursor_request = store
                    .index("timestamp")
                    .openCursor(time_range, "prev");

                // store.getAll()

                cursor_request.onsuccess = (event) => {
                    // @ts-expect-error
                    const cursor: IDBCursorWithValue = event.target.result;

                    if (cursor) {
                        let item_out_of_stock =
                            out_of_stock_variant_ids.has(
                                cursor.value.location_id,
                            ) &&
                            out_of_stock_variant_ids
                                .get(cursor.value.location_id)
                                ?.has(cursor.value.variant_id);

                        if (item_out_of_stock) {
                            if (!sales_by_item.has(cursor.value.variant_id)) {
                                sales_by_item.set(cursor.value.variant_id, {
                                    variant_id: cursor.value.variant_id,
                                    last_before_out_of_stock:
                                        cursor.value.timestamp,
                                    quantity_in_30_days_by_loc_id: new Map(),
                                });
                            }

                            if (
                                !sales_by_item
                                    .get(cursor.value.variant_id)
                                    ?.quantity_in_30_days_by_loc_id.has(
                                        cursor.value.location_id,
                                    )
                            ) {
                                sales_by_item
                                    .get(cursor.value.variant_id)
                                    ?.quantity_in_30_days_by_loc_id.set(
                                        cursor.value.location_id,
                                        0,
                                    );
                            }

                            // @ts-ignore
                            if (
                                // @ts-ignore
                                sales_by_item.get(cursor.value.variant_id)
                                    ?.last_before_out_of_stock -
                                    cursor.value.timestamp <
                                30 * 86400 * 1000
                            ) {
                                let _tmp = sales_by_item
                                    .get(cursor.value.variant_id)
                                    ?.quantity_in_30_days_by_loc_id.get(
                                        cursor.value.location_id,
                                    );
                                sales_by_item
                                    .get(cursor.value.variant_id)
                                    ?.quantity_in_30_days_by_loc_id.set(
                                        cursor.value.location_id,
                                        _tmp + cursor.value.amount,
                                    );
                            }
                        } else {
                            if (
                                current_time.getTime() -
                                    cursor.value.timestamp <
                                30 * 86400 * 1000
                            ) {
                                if (
                                    !sales_by_item.has(cursor.value.variant_id)
                                ) {
                                    sales_by_item.set(cursor.value.variant_id, {
                                        variant_id: cursor.value.variant_id,
                                        last_before_out_of_stock:
                                            current_time.getTime(),
                                        quantity_in_30_days_by_loc_id:
                                            new Map(),
                                    });
                                }

                                if (
                                    !sales_by_item
                                        .get(cursor.value.variant_id)
                                        ?.quantity_in_30_days_by_loc_id.has(
                                            cursor.value.location_id,
                                        )
                                ) {
                                    sales_by_item
                                        .get(cursor.value.variant_id)
                                        ?.quantity_in_30_days_by_loc_id.set(
                                            cursor.value.location_id,
                                            0,
                                        );
                                }

                                let _tmp = sales_by_item
                                    .get(cursor.value.variant_id)
                                    ?.quantity_in_30_days_by_loc_id.get(
                                        cursor.value.location_id,
                                    );
                                sales_by_item
                                    .get(cursor.value.variant_id)
                                    ?.quantity_in_30_days_by_loc_id.set(
                                        cursor.value.location_id,
                                        _tmp + cursor.value.amount,
                                    );
                            }
                        }

                        last_order_time_ms = Math.max(
                            last_order_time_ms,
                            cursor.value.timestamp,
                        );
                        cursor.continue();
                    } else {
                        db.close();
                        resolve({ last_order_time_ms, sales_by_item });
                    }
                };
            };
        });
    }

    async function savePastOrdersToIndexedDB(records: VariantOrder[]) {
        // indexed_db.
        let v: VariantOrder;
        const db_request = indexedDB.open("db", 1);

        db_request.onerror = (event) => {
            handle_request_err("Cannot connect to IndexedDB");
            return;
        };

        db_request.onsuccess = (event) => {
            // @ts-expect-error
            const idb: IDBDatabase = event.target.result;

            const tx: IDBTransaction = idb.transaction(
                "past_orders",
                "readwrite",
            );

            const store = tx.objectStore("past_orders");

            // Commit to IndexedDB
            records.forEach((record) => {
                store.put(record);
            });

            tx.commit();
            idb.close();
        };
    }

    function getLastOrderTime() {
        let time_start = new Date();

        time_start.setDate(time_start.getDate() - 180);
        time_start.setHours(0, 0, 0, 0);

        let s = localStorage.getItem("last_order_ms");

        if (s != null) {
            // @ts-ignore
            return parseInt(s);
        } else {
            return time_start.getTime();
        }
    }

    async function updateLastOrderTime(time_ms: number) {
        localStorage.setItem("last_order_ms", time_ms.toString());
    }

    async function fetchAndCacheOrderHistoryV2(
        out_of_stock_variant_ids: Map<number, Set<number>>,
    ) {
        let o_incomplete = false;
        let time_start = new Date(getLastOrderTime());
        let batch_limit = 250;

        let past_orders_record: VariantOrder[] = [];

        // Get the newer records first
        // The API doesn't support millisecond timestamp for filtering, so we strip the millisecond part from our timestamps
        let resp = await a.get(`${proxyUrl}/admin/orders.json`, {
            params: {
                page: 1,
                limit: 1,
                status: "completed",
                modified_on_min: time_start.toISOString().split(".")[0] + "Z",
                // modified_on_max: time_end.toISOString().split(".")[0]+"Z",
            },
        });

        if (resp.status != 200) {
            handle_request_err(resp.statusText);
            return { past_orders_record: [], o_incomplete: true };
        }

        let total_pages = Math.ceil(
            JSON.parse(resp.data).metadata.total / batch_limit,
        );

        // let raw_order_pages = [];

        // Fetch raw data

        // Batch-fetching products API, 3 at a time due to the 2 req/second ratelimit, each reqs taking ~600 ms to process
        // Process while fetching to avoid high memory load

        if (JSON.parse(resp.data).metadata.total != 0) {
            for (let i = 1; i <= Math.max(total_pages - 2, 1); i += 3) {
                let x = await Promise.all([
                    a.get(`${proxyUrl}/admin/orders.json`, {
                        params: {
                            page: i,
                            limit: batch_limit,
                            status: "completed",
                            modified_on_min:
                                time_start.toISOString().split(".")[0] + "Z",
                            // modified_on_max: time_end.toISOString().split(".")[0]+"Z",
                        },
                    }),
                    a.get(`${proxyUrl}/admin/orders.json`, {
                        params: {
                            page: i + 1,
                            limit: batch_limit,
                            status: "completed",
                            modified_on_min:
                                time_start.toISOString().split(".")[0] + "Z",
                            // modified_on_max: time_end.toISOString().split(".")[0]+"Z",
                        },
                    }),
                    a.get(`${proxyUrl}/admin/orders.json`, {
                        params: {
                            page: i + 2,
                            limit: batch_limit,
                            status: "completed",
                            modified_on_min:
                                time_start.toISOString().split(".")[0] + "Z",
                            // modified_on_max: time_end.toISOString().split(".")[0]+"Z",
                        },
                    }),
                ]);

                // Purge raw JSON pages more frequently to avoid OOM
                let raw_order_pages = [];

                for (let j = 0; j < x.length; j++) {
                    if (x[j].status != 200) {
                        handle_request_err(x[j].statusText);
                        o_incomplete = true;
                    } else {
                        raw_order_pages.push(x[j].data);
                    }
                }

                // Map orders to its shipping time
                raw_order_pages.forEach((data) => {
                    let orders_json = JSON.parse(data).orders;
                    orders_json.forEach((order: any) => {
                        if (
                            order.status != "cancelled" &&
                            order.return_status != "returned" &&
                            new Date(order.modified_on).getTime() >
                                time_start.getTime()
                        ) {
                            order.order_line_items.forEach((line_item: any) => {
                                if (line_item.is_composite) {
                                    // Split into individual items
                                    line_item.composite_item_domains.forEach(
                                        (item: any) => {
                                            past_orders_record.push({
                                                variant_id: item.variant_id,
                                                // product_id: item.product_id,
                                                timestamp: new Date(
                                                    order.modified_on,
                                                ).getTime(),
                                                amount: line_item.quantity,
                                                location_id: order.location_id,
                                            });
                                        },
                                    );
                                } else {
                                    past_orders_record.push({
                                        variant_id: line_item.variant_id,
                                        // product_id: line_item.product_id,
                                        timestamp: new Date(
                                            order.modified_on,
                                        ).getTime(),
                                        amount: line_item.quantity,
                                        location_id: order.location_id,
                                    });
                                }
                            });
                        }
                    });
                });
            }
        }

        // Write new entries to IndexedDB
        savePastOrdersToIndexedDB(past_orders_record);

        // Aggregate data from there

        let end = new Date();
        let begin = new Date();
        begin.setHours(0, 0, 0, 0);
        begin.setDate(begin.getDate() - 180);

        let { sales_by_item, last_order_time_ms } =
            await getPastOrdersFromIndexedDB(
                begin,
                end,
                out_of_stock_variant_ids,
            );

        updateLastOrderTime(last_order_time_ms);

        return { sales_by_item, o_incomplete };
    }

    async function getRestockQuantityForItems(
        sales_by_item: Map<number, VariantSold>,
        inventory_info: Map<number, VariantListing>,
        location_id: number,
    ) {
        // If (available + incoming) <= 1/3 * (sold + outgoing) --> restock = 1/2 (sold)

        // Workaround to force update the datagrid

        if (location_id == -1) {
            return [];
        }

        let _inv_info = inventory_info.values().toArray();

        let for_deletion = new Set<number>();

        _inv_info.forEach((variant, i, __) => {
            _inv_info[i].c_incoming = 0;
            _inv_info[i].c_sold = 0;

            _inv_info[i].restock = 0;
            _inv_info[i].restock_half = 0;
            _inv_info[i].restock_third = 0;

            let available = 0;
            let incoming = 0;
            let outgoing = 0;

            if (variant.inventory_levels_by_loc_id.has(location_id)) {
                available =
                    variant.inventory_levels_by_loc_id.get(location_id)
                        ?.available ?? 0;
                incoming =
                    variant.inventory_levels_by_loc_id.get(location_id)
                        ?.incoming ?? 0;
                outgoing =
                    variant.inventory_levels_by_loc_id.get(location_id)
                        ?.outgoing ?? 0;
            }

            let sold = 0;
            let restock = 0;
            if (sales_by_item.has(variant.id)) {
                // If item has been sold at one point
                // sold = sales_by_item.get(variant_id)?.quantity_in_30_days ?? 0
                sold =
                    sales_by_item
                        .get(variant.id)
                        ?.quantity_in_30_days_by_loc_id.get(location_id) ?? 0;
            }

            // If (available + incoming) <= 1/3 (sold + outgoing)

            if (available + incoming <= (1 / 3) * sold) {
                // restock = Math.round(sold + outgoing);
                restock = Math.round(sold);
                if (
                    restock == 0 &&
                    // @ts-ignore
                    _inv_info[i].inventory_levels_by_loc_id.get(location_id)
                        .on_hand == 0
                ) {
                    for_deletion.add(i);
                } else {
                    _inv_info[i].restock = restock;
                    _inv_info[i].restock_half = Math.round(restock / 2);
                    _inv_info[i].restock_third = Math.round(restock / 3);
                    _inv_info[i].c_incoming = incoming;
                    _inv_info[i].c_sold = sold;
                    _inv_info[i].c_on_hand =
                        _inv_info[i].inventory_levels_by_loc_id.get(
                            location_id,
                        )?.on_hand;
                }
            } else {
                if (
                    _inv_info[i].inventory_levels_by_loc_id.get(location_id)
                        ?.on_hand == 0
                ) {
                    for_deletion.add(i);
                } else {
                    _inv_info[i].restock = restock;
                    _inv_info[i].restock_half = Math.round(restock / 2);
                    _inv_info[i].restock_third = Math.round(restock / 3);
                    _inv_info[i].c_incoming = incoming;
                    _inv_info[i].c_sold = sold;
                    _inv_info[i].c_on_hand =
                        _inv_info[i].inventory_levels_by_loc_id.get(
                            location_id,
                        )?.on_hand;
                }
            }
        });

        // _inv_info.filter()
        _inv_info = _inv_info.filter((_, i, __) => {
            return !for_deletion.has(i);
        });

        return _inv_info;
    }

    async function getSuppliers() {}

    async function getLocations(): Promise<Location[]> {
        let resp = await a.get(`${proxyUrl}/admin/locations.json`);
        // let location_by_id: Map<number, string> = new Map()
        let location_by_id: Location[] = [];
        if (resp.status != 200) {
            handle_request_err(resp.statusText);
            return location_by_id;
        } else {
            let locs = JSON.parse(resp.data).locations;
            locs.forEach((loc: any) => {
                let addrs: string[] = [
                    loc.address1,
                    loc.address2,
                    loc.district,
                    loc.city,
                    loc.country,
                ];
                addrs = addrs.filter((v, _, __) => {
                    return v != "" && v != null;
                });
                location_by_id.push({
                    id: loc.id,
                    address: addrs.join(", "),
                    label: loc.label,
                });
            });
        }

        return location_by_id;
    }

    // let data = $state([{sku: "8809871383333"}])

    const sortDirections = [
        { id: 1, icon: "mdi mdi-arrow-up" },
        { id: -1, icon: "mdi mdi-arrow-down" },
    ];

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
            header: "SKU",
            resize: true,
            width: 130,
        },
        {
            id: "name",
            header: "Tên sản phẩm",
            resize: true,

            width: 250,
        },

        {
            id: "image",
            header: "Ảnh",
            cell: ImageCell,
            sort: true,
        },
        {
            id: "image_path",
            hidden: true,
            sort: true,
        },
        {
            id: "restock_third",
            header: "SL đặt\n(1/3 tháng)",
            resize: true,

            width: 100,
        },
        {
            id: "restock_half",
            header: "SL đặt\n(1/2 tháng)",
            resize: true,

            width: 100,
        },
        {
            id: "restock",
            header: "SL đặt\n(1 tháng)",
            resize: true,

            width: 100,
        },
        {
            id: "c_on_hand",
            header: "Tồn kho",
            resize: true,
            width: 100,
        },
        {
            id: "c_incoming",
            header: "Đang về",
            resize: true,
            width: 100,
        },

        {
            id: "brand",
            header: "Nhãn hiệu",
            resize: true,
            width: 140,
        },
        {
            id: "unit",
            header: "Đơn vị tính",
            resize: true,
            width: 140,
        },
        {
            id: "included_tax_import_price",
            header: "Giá nhập",
            resize: true,
            width: 140,
        },
        {
            id: "included_tax_price",
            header: "Thành tiền (Shop)",
            resize: true,
            width: 140,
        },
        {
            id: "included_tax_price_ecomm",
            header: "Thành tiền (TMĐT)",
            resize: true,
            width: 140,
        },
    ];

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
                    header: "SKU",
                    resize: true,
                    width: 90,
                },
                {
                    id: "name",
                    header: "Tên sản phẩm",
                    resize: true,

                    width: 200,
                },

                {
                    id: "image",
                    header: "Ảnh",
                    cell: ImageCell,
                    sort: true,
                },
                {
                    id: "image_path",
                    hidden: true,
                    sort: true,
                },
                {
                    id: "restock_third",
                    header: "SL đặt\n(1/3 tháng trước)",
                    resize: true,

                    width: 100,
                },
                {
                    id: "restock_half",
                    header: "SL đặt\n(1/2 tháng)",
                    resize: true,

                    width: 100,
                },
                {
                    id: "restock",
                    header: "SL đặt\n(1 tháng)",
                    resize: true,

                    width: 100,
                },
                {
                    id: "c_on_hand",
                    header: "Tồn kho",
                    resize: true,
                    width: 100,
                },
                {
                    id: "c_incoming",
                    header: "Đang về",
                    resize: true,
                    width: 100,
                },

                {
                    id: "brand",
                    header: "Nhãn hiệu",
                    resize: true,
                    width: 140,
                },
                {
                    id: "unit",
                    header: "Đơn vị tính",
                    resize: true,
                    width: 140,
                },
                {
                    id: "included_tax_import_price",
                    header: "Giá nhập",
                    resize: true,
                    width: 140,
                },
                {
                    id: "included_tax_price",
                    header: "Thành tiền (Shop)",
                    resize: true,
                    width: 140,
                },
                {
                    id: "included_tax_price_ecomm",
                    header: "Thành tiền (TMĐT)",
                    resize: true,
                    width: 140,
                },
            ],
        },
    };

    // For filtering purpose

    const fields = [
        {
            id: "name_normalized",
            label: "Tên sản phẩm",
            type: "text",
        },
        {
            id: "sku",
            label: "SKU",
            type: "text",
        },
        {
            id: "restock_third",
            label: "SL đặt (= 1/3 SL tháng trước)",
            type: "number",
        },
        {
            id: "restock_half",
            label: "SL đặt (= 1/2 SL tháng trước)",
            type: "number",
        },
        {
            id: "restock",
            label: "SL đặt (= SL tháng trước)",
            type: "number",
        },
        {
            id: "c_sold",
            label: "Số lượng bán (30 ngày)",
            type: "number",
        },
        {
            id: "c_on_hand",
            label: "Tồn kho",
            type: "number",
        },
        {
            id: "c_incoming",
            label: "Đang về",
            type: "number",
        },
        {
            id: "brand",
            label: "Nhãn hiệu",
            type: "text",
        },
        {
            id: "unit",
            label: "Đơn vị tính",
            type: "text",
        },
        {
            id: "included_tax_import_price",
            label: "Giá nhập",
            type: "number",
        },
        {
            id: "included_tax_price",
            label: "Thành tiền (Shop)",
            type: "number",
        },
        {
            id: "included_tax_price_ecomm",
            label: "Thành tiền (TMĐT)",
            type: "number",
        },
        {
            id: "category",
            label: "Phân loại",
            type: "text",
        },
    ];

    let locations = $state(new Array<Location>());
    let selected_location_id = $state(-1);
    let is_loading = $state(false);

    let data: VariantListing[] = $state([]);
    let left_split = 1;

    let grid_api: any = $state();

    let inventory_info: VariantListing[] = [];

    let row_count = $state(0);

    let selected_skus: Set<string> = $state(new Set());
    setContext("selected_skus", selected_skus);

    let sales_by_item: Map<number, VariantSold> = new Map();

    let variants: Map<number, VariantListing> = new Map();

    let key = $state(0);
    let checkbox_key = $state({ k: 0 });
    setContext("checkbox_key", checkbox_key);

    let last_sort_key = "";
    let last_sort_order: "asc" | "dsc" | "" = "";

    let filter_val = $state({});

    let options = $state({});

    // let low_sales: VariantListing[] = $state([]);
    let low_sales: Set<string> = $state(new Set());

    function obtain_access_token() {
        return "Bearer " + sessionStorage.getItem("token");
    }

    function toggle_visibility_select_all_btn_from_filterbuilder(
        visible: boolean,
        filterEditor: Element,
        list: HTMLElement,
    ) {
        const btn = filterEditor
            .getElementsByClassName("wx-button")
            .item(0) as HTMLElement;

        if (visible) {
            btn.style.display = "inline-block";
            list.style.display = "block";
        } else {
            btn.style.display = "none";
            list.style.display = "none";
        }
    }

    const mutObserver = new MutationObserver((mutations, observer) => {
        const filterArea = document.getElementById("filter-area");
        const filterEditor = filterArea
            ?.getElementsByClassName("wx-filter-editor")
            .item(0);
        // @ts-ignore
        const list = Array.from(filterEditor.children).filter((child) =>
            child.classList.contains("wx-list"),
        )[0];

        if (!filterArea || !filterEditor || !list) {
            return;
        }

        if (list?.childElementCount == 0) {
            toggle_visibility_select_all_btn_from_filterbuilder(
                false,
                filterEditor,
                list as HTMLElement,
            );
        } else {
            toggle_visibility_select_all_btn_from_filterbuilder(
                true,
                filterEditor,
                list as HTMLElement,
            );
        }
    });

    function handle_grid_data_request(ev: any) {
        const { row } = ev;
        if (row) {
            data = inventory_info.slice(row.start, row.end);
        }
    }

    function initialize_grid() {}

    function get_unique_values_for_fields(source: VariantListing[]) {
        let options = {
            name: new Set<string>(),
            sku: new Set<string>(),
            restock_third: new Set<number>(),
            restock_half: new Set<number>(),
            restock: new Set<number>(),
            c_incoming: new Set<number>(),
            brand: new Set<string>(),
            unit: new Set<string>(),
            included_tax_import_price: new Set<number>(),
            included_tax_price: new Set<number>(),
            included_tax_price_ecomm: new Set<number>(),
            category: new Set<string>(),
        };
        source.forEach((v, _, __) => {
            // options.name.add(v.name)

            if (v.brand) {
                options.brand.add(v.brand);
            }

            if (v.unit) {
                options.unit.add(v.unit);
            }

            if (v.category) {
                options.category.add(v.category);
            }
        });

        // Convert to array
        const opts_converted = {
            // name: Array.from(options.name),
            sku: Array.from(options.sku),
            restock_third: Array.from(options.restock_third),
            restock_half: Array.from(options.restock_half),
            restock: Array.from(options.restock),
            brand: Array.from(options.brand),
            c_incoming: Array.from(options.c_incoming),
            unit: Array.from(options.unit),
            included_tax_import_price: Array.from(
                options.included_tax_import_price,
            ),
            included_tax_price: Array.from(options.included_tax_price),
            included_tax_price_ecomm: Array.from(
                options.included_tax_price_ecomm,
            ),
            category: Array.from(options.category),
        };

        // @ts-ignore
        options = null;

        return opts_converted;
    }

    function select_all() {
        inventory_info.forEach((v, _, __) => {
            selected_skus.add(v.sku);
        });
        checkbox_key.k += 1;
    }

    function deselect_all() {
        selected_skus.clear();
        checkbox_key.k += 1;
    }

    function get_low_sales_skus(list: VariantListing[]) {
        const threshold = 20;
        // @ts-ignore
        let s = new Set<string>();

        let x = list.filter((v, _, __) => {
            // @ts-ignore
            return v.c_sold < threshold;
        });

        x.forEach((v, _, __) => {
            s.add(v.sku);
        });

        x = [];

        return s;
    }

    async function load_data() {
        // Initialize IndexedDB
        // let _stopwatch_start = new Date().getTime()

        indexed_db = window.indexedDB.open("db", 1);
        indexed_db.onupgradeneeded = (ev: IDBVersionChangeEvent) => {
            // @ts-expect-error
            const db: IDBDatabase = ev.target.result;
            const store = db.createObjectStore("past_orders", {
                autoIncrement: true,
            });
            if (!store.indexNames.contains("timestamp")) {
                store.createIndex("timestamp", "timestamp");
            }
        };

        let { raw_product_pages, p_incomplete } =
            await fetchRawPagesFromProductsAPI();

        let active_non_composite_prods = await getActiveNonCompositeProducts(
            raw_product_pages,
            "",
        );

        variants = active_non_composite_prods.variants;
        let items_need_tracing_back_by_loc_id =
            active_non_composite_prods.items_need_tracing_back_by_loc_id;

        let order_history = await fetchAndCacheOrderHistoryV2(
            items_need_tracing_back_by_loc_id,
        );

        // @ts-ignore
        sales_by_item = order_history.sales_by_item;
        let o_incomplete = order_history.o_incomplete;

        locations = await getLocations();
        selected_location_id = locations[0].id;

        inventory_info = await getRestockQuantityForItems(
            sales_by_item,
            variants,
            selected_location_id,
        );
        row_count = inventory_info.length;

        low_sales = get_low_sales_skus(inventory_info);
    }

    function initialize_filter() {
        options = get_unique_values_for_fields(inventory_info);
        // @ts-ignore
        filter_api.on("delete-rule", ({ id }) => {
            if (id == low_sales_filter_id) {
                low_sales_filter_id = null;
            }
        });
    }

    let is_filter_empty = $state(true);

    async function handle_filter_update(value: any | null) {
        if (value == null) {
            inventory_info = await getRestockQuantityForItems(
                sales_by_item,
                variants,
                selected_location_id,
            );
            low_sales_filter_id = null;
            filter_val = {};
            is_filter_empty = true;
        } else {
            inventory_info = await getRestockQuantityForItems(
                sales_by_item,
                variants,
                selected_location_id,
            );
            const filter = createArrayFilter(value);

            inventory_info = filter(inventory_info);
        }

        apply_sorting_rule(null);

        data = [];
        row_count = inventory_info.length;
        key += 1;

        if (value.rules == undefined) {
            is_filter_empty = true;
        } else {
            is_filter_empty = false;
        }
    }

    async function handle_location_change() {
        inventory_info = await getRestockQuantityForItems(
            sales_by_item,
            variants,
            selected_location_id,
        );

        low_sales = get_low_sales_skus(inventory_info);

        selected_skus.clear();
        sorting_dir = 1;
        sorting_key = "";
        data = [];
        key += 1;
        initialize_filter();
    }

    let sorting_key = $state("");
    let sorting_dir = $state(1);

    async function apply_sorting_rule(ev: any) {
        if (sorting_key == "") {
            return;
        }

        inventory_info.sort((a, b) => {
            // @ts-ignore
            let v_a = a[sorting_key as keyof InventoryLevel];
            // @ts-ignore
            let v_b = b[sorting_key as keyof InventoryLevel];
            if (sorting_dir == 1) {
                // Sort ascending
                if (typeof v_a == "string") {
                    return v_a.toLowerCase().localeCompare(v_b.toLowerCase());
                } else {
                    return v_a - v_b;
                }
            } else {
                // Sort descending
                if (typeof v_a == "string") {
                    return v_b.toLowerCase().localeCompare(v_a.toLowerCase());
                } else {
                    return v_b - v_a;
                }
            }
        });
        key += 1;
    }

    let side_panel_visibility = $state(true);
    let side_panel_disp_mode = "";
    function toggle_side_panel() {
        side_panel_visibility = !side_panel_visibility;
        if (!side_panel_visibility) {
            // @ts-ignore
            side_panel_disp_mode =
                document.getElementById("side-panel")?.style.display;
            // @ts-ignore
            document.getElementById("side-panel").style.display = "none";

            // @ts-ignore
            document.getElementById("grid-container").style.height =
                "calc(100% - 46px)";
        } else {
            // @ts-ignore
            document.getElementById("side-panel").style.display =
                side_panel_disp_mode;
            // @ts-ignore
            document.getElementById("grid-container").style.height = "100%";
        }
    }

    let reload_cnt = $state(0);

    async function soft_reload() {
        await initialize();
        key += 1;
    }

    function ui_patching() {
        // Turning add-filter button to block
        const filterArea = document.getElementById("filter-area");

        const filterBuilder =
            // @ts-ignore
            filterArea.getElementsByClassName("wx-filter-builder")[0];
        const filterBuilderToolbar =
            filterBuilder.getElementsByClassName("wx-toolbar")[0];
        const filterBuilderAddFilterBtn = Array.from(
            filterBuilderToolbar.children,
        ).find((v) => v.classList.contains("wx-button"));
        filterBuilderAddFilterBtn?.classList.add("wx-block");
    }

    async function initialize() {
        mutObserver.disconnect();

        await lazyLoadStylesheets(
            "https://cdn.jsdelivr.net/npm/@mdi/font@7.4.47/css/materialdesignicons.min.css",
        );
        ui_patching();
        accessToken = obtain_access_token();
        isAccountAdmin = sessionStorage.getItem("isadmin") == "true";
        is_loading = true;
        console.time("load_content");
        await load_data();
        console.timeEnd("load_content");
        is_loading = false;

        low_sales_filter_id = null;
        filter_val = {};

        // Initialize Datagrid
        initialize_grid();
        initialize_filter();

        mutObserver.observe(
            // @ts-ignore
            document.getElementById("filter-area"),
            { childList: true, subtree: true },
        );
    }

    // @ts-ignore
    let filter_api = $state();
    let low_sales_filter_id: string | number | null = $state(null);

    async function filter_low_sales() {
        if (!low_sales_filter_id) {
            // @ts-ignore
            filter_api.exec("add-rule", {
                rule: {
                    field: "c_sold",
                    filter: "less",
                    value: 20,
                },
                edit: false,
            });

            // @ts-ignore
            const fval = filter_api.getValue();
            // @ts-ignore
            const fstate: Map<number, Object> =
                // @ts-ignore
                filter_api.getState().value._pool;
            await handle_filter_update(fval);

            // Find the ID of the added rule

            for (const v of fstate) {
                // @ts-ignore
                if (v[1].field && v[1].field == "c_sold") {
                    // @ts-ignore
                    if (
                        // @ts-ignore
                        v[1].filter &&
                        // @ts-ignore
                        v[1].filter == "less" &&
                        // @ts-ignore
                        v[1].value == 20
                    ) {
                        // @ts-ignore
                        low_sales_filter_id = v[1].id;
                        break;
                    }
                }
            }
        } else {
            // @ts-ignore
            filter_api.exec("delete-rule", {
                id: low_sales_filter_id,
            });
            low_sales_filter_id = null;
        }
    }

    // Get base64 from image URL
    async function getArrayBufferFromImageUrl(
        url: string,
    ): Promise<{ a: ArrayBuffer; t: string | undefined }> {
        try {
            const resp = await axios.get(url, {
                responseType: "arraybuffer",
            });

            return {
                a: resp.data,
                t: resp.headers["Content-Type"]?.toString(),
            };
        } catch (err) {
            console.error("Error fetching image: ", err);
            throw err; // important: don't let the error silently drop
        }
    }

    const canvas = document.createElement("canvas");
    async function downscaleImage(img: HTMLImageElement) {
        return new Promise<ArrayBuffer>((resolve, reject) => {
            canvas.width = 160;
            canvas.height = (img.height / img.width) * 160;

            const ctx = canvas.getContext("2d");
            // @ts-ignore
            ctx.fillStyle = "white";
            ctx?.fillRect(0, 0, canvas.width, canvas.height);
            ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);

            canvas.toBlob(async (blob) => {
                // @ts-ignore
                resolve(await blob.arrayBuffer());
            });
        });
    }

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
        inventory_info.forEach((v, _, __) => {
            if (selected_skus.size == 0 || selected_skus.has(v.sku)) {
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
            }
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
        for (const v of inventory_info) {
            if (selected_skus.size == 0 || selected_skus.has(v.sku)) {
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
                console.log("fetched image");
            }
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
            `Thống kê_${c_loc?.label.replace("W", "")}_${time.getDate()}-${time.getMonth() + 1}-${time.getFullYear()}.xlsx`,
        );
    }

    let settings_modal_visible = $state(false);
    let inventory_checkup_modal_visible = $state(false);

    async function logout() {
        await a.delete(`${baseUrl}/revoke`);
        sessionStorage.clear();
        goto("/authentication");
    }

    onMount(async () => {
        await initialize();
        mutObserver.observe(
            // @ts-ignore
            document.getElementById("filter-area"),
            { childList: true, subtree: true },
        );
    });
</script>

<Locale words={vi}>
    <Willow>
        <div class="container">
            <div class="ribbon" id="side-panel">
                <div style=" margin-bottom: 10px">
                    <Button
                        id="collapse-side-panel"
                        onclick={toggle_side_panel}
                        type="primary"
                        icon="mdi mdi-menu"
                    ></Button>
                    <Button onclick={soft_reload} icon="mdi mdi-refresh">
                        Tải lại
                    </Button>

                    <!-- Settings button -->
                    <Button
                        icon="mdi mdi-cog"
                        onclick={() => {
                            settings_modal_visible = true;
                        }}
                    ></Button>

                    <!-- Logout button -->
                    <Button type="danger" onclick={logout} icon="mdi mdi-logout"
                    ></Button>
                </div>
                <Field label="Kho hàng " position="top">
                    <div style="margin-top: 5px;">
                        <Select
                            textField="label"
                            options={locations}
                            placeholder="Vui lòng chọn kho..."
                            bind:value={selected_location_id}
                            onchange={handle_location_change}
                        ></Select>
                    </div>
                </Field>

                <div class="select-btn-rows">
                    <Button
                        icon="mdi mdi-check-all"
                        onclick={select_all}
                        type="secondary block">Chọn tất cả</Button
                    >
                    <Button
                        onclick={deselect_all}
                        type="secondary block"
                        icon="mdi mdi-select">Bỏ chọn hết</Button
                    >
                </div>
                <div class="export-btn-wrapper">
                    <Button
                        icon="mdi mdi-package-variant-closed-check"
                        type="secondary block"
                        onclick={() => {
                            inventory_checkup_modal_visible = true;
                        }}>Danh sách Kiểm hàng</Button
                    >
                    <Button
                        type="secondary block"
                        onclick={exportToXLSX}
                        icon="mdi mdi-download">Xuất file Excel</Button
                    >
                </div>

                {#if low_sales.size != 0}
                    <div class="toast-warn" style="margin-bottom: 15px">
                        <p style="margin:0px; margin-bottom: 5px">
                            <b>{low_sales.size}</b> mặt hàng có số lượng bán quá
                            thấp
                        </p>
                        {#if !low_sales_filter_id}
                            <Button type="secondary" onclick={filter_low_sales}
                                >Xem chi tiết</Button
                            >
                        {/if}
                        {#if low_sales_filter_id}
                            <Button type="secondary" onclick={filter_low_sales}
                                >Quay lại</Button
                            >
                        {/if}
                    </div>
                {/if}
                <!-- Sorting part -->
                <Field
                    label="Sắp xếp & Lọc"
                    position="top"
                    style="margin-bottom: 5px"
                >
                    <div style="display: flex; gap: 10px; margin-top: 10px">
                        <Select
                            bind:value={sorting_key}
                            onchange={apply_sorting_rule}
                            options={fields}
                            placeholder="Sắp xếp theo..."
                        ></Select>
                        <Segmented
                            bind:value={sorting_dir}
                            width="100"
                            options={sortDirections}
                            onchange={apply_sorting_rule}
                        ></Segmented>
                    </div>

                    <div style="margin-top: 10px;">
                        <!-- Filter part -->
                        <Field position="top">
                            <div
                                id="filter-area"
                                style="display: flex; flex-direction: column; margin-top:0px; gap: 10px"
                            >
                                {#if !is_filter_empty}
                                    <Button
                                        icon="mdi mdi-filter-remove-outline"
                                        id="clear-filter-btn"
                                        onclick={() =>
                                            handle_filter_update(null)}
                                        type="secondary block"
                                        >Xóa mọi bộ lọc
                                    </Button>
                                {/if}

                                <FilterBuilder
                                    bind:this={filter_api}
                                    bind:value={filter_val}
                                    onchange={({ value }: { value: any }) =>
                                        handle_filter_update(value)}
                                    {fields}
                                    {options}
                                />
                            </div>
                        </Field>
                    </div>
                </Field>
            </div>

            <div class="grid">
                {#if !side_panel_visibility}
                    <div
                        class="side-panel-toggle"
                        style="margin-bottom: 10px; display: flex; gap: 5px"
                    >
                        <Button
                            width="36"
                            type="default"
                            icon="mdi mdi-menu"
                            onclick={toggle_side_panel}
                        ></Button>

                        <Button onclick={soft_reload} icon="mdi mdi-refresh">
                            Tải lại
                        </Button>
                        <Button icon="mdi mdi-download" onclick={exportToXLSX()}
                        ></Button>

                        <!-- Settings button -->
                        <Button
                            icon="mdi mdi-cog"
                            onclick={() => {
                                settings_modal_visible = true;
                            }}
                        ></Button>

                        <!-- Logout button -->
                        <Button
                            type="danger"
                            onclick={logout}
                            icon="mdi mdi-logout"
                        ></Button>
                    </div>
                {/if}

                <div
                    id="grid-container"
                    style="height: calc(100%); width: 100%"
                >
                    {#key key}
                        <Grid
                            sizes={{ rowHeight: 165 }}
                            {key}
                            autoRowHeight
                            dynamic={{
                                rowCount: row_count,
                                columnCount: 10,
                            }}
                            onrequestdata={handle_grid_data_request}
                            bind:this={grid_api}
                            {data}
                            {columns}
                            responsive={responsive_fields}
                            split={{ left: left_split }}
                            rowStyle={(row: any) =>
                                low_sales.has(row.sku) ? "lowSales" : ""}
                        ></Grid>
                    {/key}
                </div>
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

            {#if settings_modal_visible}
                <Portal>
                    <SettingsModal bind:shown={settings_modal_visible}
                    ></SettingsModal>
                </Portal>
            {/if}

            {#if inventory_checkup_modal_visible}
                <Portal>
                    <InventoryCheckupScreen
                        bind:shown={inventory_checkup_modal_visible}
                        data={inventory_info}
                        {locations}
                        {selected_location_id}
                    ></InventoryCheckupScreen>
                </Portal>
            {/if}
        </div>
    </Willow>

    <style>
        /* Switch accent color */
        .wx-glue-wrapper {
            display: none;
        }

        .wx-panel {
            padding-top: 0px;
        }

        .wx-willow-theme {
            --wx-color-primary: #0520c3;
            --wx-filter-border: 1px solid #c1c1c1;
        }

        div .toast-warn {
            background-color: #ffc04c;
            padding: 10px;
            border-radius: 5px;
        }

        .lowSales {
            background: #ffc04c !important;
        }

        .container {
            display: flex;
            /* flex-direction: column; */
            max-height: 100vh;
            max-width: 100vw;
            gap: 10px;
        }

        .grid {
            flex-grow: 1;
            overflow: hidden;
            width: 100%;
            max-width: 100%;
            max-height: calc(100vh - 15px);
            height: calc(100vh - 15px);
        }

        .ribbon {
            display: flex;
            flex-direction: column;
            width: 300px;
            max-width: 300px;
            min-width: 300px;
            /* gap: 10px */
            overflow-y: scroll;
            margin: 0px;
        }

        .select-btn-rows {
            display: flex;
            flex-direction: row;
            gap: 10px;

            margin-bottom: 10px;
        }

        .export-btn-wrapper {
            display: flex;
            flex-direction: column;
            gap: 10px;
            margin-bottom: 20px;
        }
    </style>
</Locale>
