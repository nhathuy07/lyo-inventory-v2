export interface VariantListing {
    name: string;
    name_normalized: string;
    brand: string;
    category: string;
    tags: string[];
    suppliers: string[];
    sku: string;
    variant_id: number;
    product_id: number;
    id: number;
    variant_creation_date: Date | null;
    included_tax_price: number;
    included_tax_price_ecomm: number;
    included_tax_import_price: number;
    unit: string;
    restock?: number;
    restock_half?: number;
    restock_third?: number;
    c_sold?: number;
    c_incoming?: number;
    c_on_hand?: number;
    image_path: string;
    inventory_levels_by_loc_id: Map<number, InventoryLevel>;
}

export interface InventoryLevel {
    incoming: number;
    outgoing: number;
    onway: number;
    available: number;
    on_hand: number;
    restock?: number;
}

export interface VariantOrder {
    timestamp: number;
    variant_id: number;
    amount: number;
    location_id: number;
}

export interface VariantSold {
    variant_id: number;
    last_before_out_of_stock: number;
    quantity_in_30_days_by_loc_id: Map<number, number>;
}

export interface Location {
    id: number;
    address: string;
    label: string;
}

export function normalizeToEnglish(str: string | undefined | null): string {
  if (!str) return "";
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, "");
}


export interface Filtering {
    key: string
    includes: Set<any>
    operator: ">" | "<" | "=" | ">=" | "<=" | "!=" | "in" | "has"
    value: any
    type: "string" | "number" | "array"
}

export interface Sorting {
    key: string
    order: 1 | -1 | 0
}