export interface EnchantStat {
    type: string;
    value?: number;
    min?: number;
    max?: number;
}

export interface EnchantInfo {
    name: string;
    stats: EnchantStat[];
} 