import { BadRequestException, Injectable } from '@nestjs/common';

type UomDefinition = {
  code: string;
  name: string;
  category: 'weight' | 'volume' | 'count';
  baseCode: string;
  factorToBase: number;
  aliases: string[];
};

export type UomConversionResult = {
  input_quantity: number;
  input_uom: string;
  base_quantity: number;
  base_uom: string;
  factor_to_base: number;
};

const UOM_DEFINITIONS: UomDefinition[] = [
  { code: 'G', name: 'Gram', category: 'weight', baseCode: 'G', factorToBase: 1, aliases: ['g', 'gm', 'gram', 'grams'] },
  { code: 'KG', name: 'Kilogram', category: 'weight', baseCode: 'G', factorToBase: 1000, aliases: ['kg', 'kgs', 'kilogram', 'kilograms'] },
  { code: 'MG', name: 'Milligram', category: 'weight', baseCode: 'G', factorToBase: 0.001, aliases: ['mg', 'milligram', 'milligrams'] },
  { code: 'BAG_5KG', name: 'Bag 5 KG', category: 'weight', baseCode: 'G', factorToBase: 5000, aliases: ['bag 5kg', '5kg bag', 'sack 5kg', '5 kg bag', '5kg sack'] },
  { code: 'BAG_10KG', name: 'Bag 10 KG', category: 'weight', baseCode: 'G', factorToBase: 10000, aliases: ['bag 10kg', '10kg bag', 'sack 10kg', '10 kg bag', '10kg sack'] },
  { code: 'BAG_20KG', name: 'Bag 20 KG', category: 'weight', baseCode: 'G', factorToBase: 20000, aliases: ['bag 20kg', '20kg bag', 'sack 20kg', '20 kg bag', '20kg sack'] },
  { code: 'BAG_25KG', name: 'Bag 25 KG', category: 'weight', baseCode: 'G', factorToBase: 25000, aliases: ['bag 25kg', '25kg bag', 'sack 25kg', '25 kg bag', '25kg sack'] },
  { code: 'BAG_40KG', name: 'Bag 40 KG', category: 'weight', baseCode: 'G', factorToBase: 40000, aliases: ['bag 40kg', '40kg bag', 'sack 40kg', '40 kg bag', '40kg sack'] },
  { code: 'BAG_50KG', name: 'Bag 50 KG', category: 'weight', baseCode: 'G', factorToBase: 50000, aliases: ['bag 50kg', '50kg bag', 'sack 50kg', '50 kg bag', '50kg sack'] },

  { code: 'ML', name: 'Milliliter', category: 'volume', baseCode: 'ML', factorToBase: 1, aliases: ['ml', 'milliliter', 'milliliters', 'millilitre', 'millilitres'] },
  { code: 'L', name: 'Liter', category: 'volume', baseCode: 'ML', factorToBase: 1000, aliases: ['l', 'ltr', 'liter', 'liters', 'litre', 'litres'] },
  { code: 'BOTTLE_250ML', name: 'Bottle 250 ML', category: 'volume', baseCode: 'ML', factorToBase: 250, aliases: ['250ml bottle', 'bottle 250ml'] },
  { code: 'BOTTLE_300ML', name: 'Bottle 300 ML', category: 'volume', baseCode: 'ML', factorToBase: 300, aliases: ['300ml bottle', 'bottle 300ml'] },
  { code: 'BOTTLE_500ML', name: 'Bottle 500 ML', category: 'volume', baseCode: 'ML', factorToBase: 500, aliases: ['500ml bottle', 'bottle 500ml'] },
  { code: 'BOTTLE_1L', name: 'Bottle 1 Liter', category: 'volume', baseCode: 'ML', factorToBase: 1000, aliases: ['1l bottle', '1 liter bottle', 'bottle 1l', 'bottle 1 liter'] },

  { code: 'PCS', name: 'Piece', category: 'count', baseCode: 'PCS', factorToBase: 1, aliases: ['pc', 'pcs', 'piece', 'pieces', 'unit', 'units'] },
  { code: 'BOTTLE', name: 'Bottle', category: 'count', baseCode: 'BOTTLE', factorToBase: 1, aliases: ['bottle', 'bottles'] },
  { code: 'CAN', name: 'Can', category: 'count', baseCode: 'CAN', factorToBase: 1, aliases: ['can', 'cans', 'tin', 'tins'] },
  { code: 'PET', name: 'PET Bottle', category: 'count', baseCode: 'PET', factorToBase: 1, aliases: ['pet', 'pets', 'pet bottle', 'pet bottles'] },
  { code: 'PACKET', name: 'Packet', category: 'count', baseCode: 'PACKET', factorToBase: 1, aliases: ['packet', 'packets', 'sachet', 'sachets'] },
  { code: 'BOX', name: 'Box', category: 'count', baseCode: 'BOX', factorToBase: 1, aliases: ['box', 'boxes'] },
  { code: 'TRAY', name: 'Tray', category: 'count', baseCode: 'TRAY', factorToBase: 1, aliases: ['tray', 'trays'] },
  { code: 'CARTON', name: 'Carton', category: 'count', baseCode: 'CARTON', factorToBase: 1, aliases: ['carton', 'cartons'] },
  { code: 'ROLL', name: 'Roll', category: 'count', baseCode: 'ROLL', factorToBase: 1, aliases: ['roll', 'rolls'] },
  { code: 'PORTION', name: 'Portion', category: 'count', baseCode: 'PORTION', factorToBase: 1, aliases: ['portion', 'portions'] },
  { code: 'SERVING', name: 'Serving', category: 'count', baseCode: 'SERVING', factorToBase: 1, aliases: ['serving', 'servings'] },
  { code: 'DOZEN', name: 'Dozen', category: 'count', baseCode: 'PCS', factorToBase: 12, aliases: ['dozen', 'dz'] },
  { code: 'PACK_6', name: 'Pack 6 Pieces', category: 'count', baseCode: 'PCS', factorToBase: 6, aliases: ['pack 6', '6 pack', '6 pcs pack', '6 bottle pack', 'pet 6', 'crate 6'] },
  { code: 'PACK_12', name: 'Pack 12 Pieces', category: 'count', baseCode: 'PCS', factorToBase: 12, aliases: ['pack 12', '12 pack', '12 pcs pack', '12 bottle pack', 'pet 12', 'crate 12'] },
  { code: 'PACK_24', name: 'Pack 24 Pieces', category: 'count', baseCode: 'PCS', factorToBase: 24, aliases: ['pack 24', '24 pack', '24 pcs pack', '24 bottle pack', 'pet 24', 'crate 24'] },
  { code: 'CRATE_6', name: 'Crate 6 Bottles', category: 'count', baseCode: 'PCS', factorToBase: 6, aliases: ['crate of 6', '6 bottle crate', 'crate 6 bottles'] },
  { code: 'CRATE_12', name: 'Crate 12 Bottles', category: 'count', baseCode: 'PCS', factorToBase: 12, aliases: ['crate of 12', '12 bottle crate', 'crate 12 bottles'] },
  { code: 'CRATE_24', name: 'Crate 24 Bottles', category: 'count', baseCode: 'PCS', factorToBase: 24, aliases: ['crate of 24', '24 bottle crate', 'crate 24 bottles'] },
];

@Injectable()
export class UomConversionService {
  private readonly unitsByAlias = new Map<string, UomDefinition>();

  constructor() {
    for (const definition of UOM_DEFINITIONS) {
      this.unitsByAlias.set(this.normalize(definition.code), definition);
      this.unitsByAlias.set(this.normalize(definition.name), definition);
      for (const alias of definition.aliases) {
        this.unitsByAlias.set(this.normalize(alias), definition);
      }
    }
  }

  listDefaults(): UomDefinition[] {
    return UOM_DEFINITIONS;
  }

  normalize(value: string | null | undefined): string {
    return String(value || '').trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
  }

  resolve(unit: string | null | undefined): UomDefinition | null {
    const normalized = this.normalize(unit);
    if (!normalized) {
      return null;
    }
    return this.unitsByAlias.get(normalized) ?? null;
  }

  assertCompatible(fromUom: string, toUom: string): void {
    const from = this.resolve(fromUom);
    const to = this.resolve(toUom);
    if (!from || !to) {
      return;
    }
    if (from.category !== to.category) {
      throw new BadRequestException(`Cannot convert ${fromUom} to ${toUom}. Unit categories do not match.`);
    }
  }

  convert(quantity: number | string, fromUom: string | null | undefined, toUom: string | null | undefined): number {
    const parsed = Number(quantity ?? 0);
    if (!Number.isFinite(parsed)) {
      throw new BadRequestException('Quantity must be a valid number.');
    }

    const from = this.resolve(fromUom);
    const to = this.resolve(toUom);
    if (!from || !to) {
      const fromNormalized = this.normalize(fromUom);
      const toNormalized = this.normalize(toUom);
      if (!fromNormalized || !toNormalized || fromNormalized === toNormalized) {
        return parsed;
      }
      throw new BadRequestException(`No UOM equivalence configured for ${fromUom} to ${toUom}.`);
    }

    if (from.category !== to.category) {
      throw new BadRequestException(`Cannot convert ${fromUom} to ${toUom}. Unit categories do not match.`);
    }

    return Number(((parsed * from.factorToBase) / to.factorToBase).toFixed(4));
  }

  toBase(quantity: number | string, fromUom: string | null | undefined, baseUom: string): UomConversionResult {
    const inputQuantity = Number(quantity ?? 0);
    const baseQuantity = this.convert(inputQuantity, fromUom || baseUom, baseUom);
    return {
      input_quantity: inputQuantity,
      input_uom: fromUom || baseUom,
      base_quantity: baseQuantity,
      base_uom: baseUom,
      factor_to_base: inputQuantity === 0 ? 0 : Number((baseQuantity / inputQuantity).toFixed(8)),
    };
  }
}
