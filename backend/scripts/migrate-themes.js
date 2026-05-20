/**
 * Migration: Add slug, description, tokens columns to themes table.
 * Drops all old flat color columns and replaces with JSONB tokens.
 * Legacy dev-only helper. Not part of the supported KitchenOS release path.
 * Use `npm run db:migrate` and `npm run bootstrap:first-run` for release setup.
 */

if (process.env.ALLOW_LEGACY_DEV_HELPER !== 'true') {
    console.error('Legacy theme migration helper disabled.');
    console.error('This script is not part of the supported release runtime. Set ALLOW_LEGACY_DEV_HELPER=true only for isolated local engineering work.');
    process.exit(1);
}

const { Client } = require('pg');

const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'kitchenos',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASS || 'postgres',
});

async function migrate() {
    await client.connect();
    console.log('✅ Connected to PostgreSQL');

    try {
        await client.query('BEGIN');

        // 1. Add new columns if they don't exist
        const addCols = `
            ALTER TABLE themes
                ADD COLUMN IF NOT EXISTS slug VARCHAR(80) UNIQUE,
                ADD COLUMN IF NOT EXISTS description VARCHAR(255),
                ADD COLUMN IF NOT EXISTS tokens JSONB;
        `;
        await client.query(addCols);
        console.log('✅ New columns added (slug, description, tokens)');

        // 2. Drop old flat color columns (after backing them up in tokens)
        // First, populate tokens from existing flat columns for any existing rows
        const backfill = `
            UPDATE themes SET tokens = jsonb_build_object(
                'accent_primary',    COALESCE(primary_color, '#0ea5e9'),
                'accent_secondary',  COALESCE(secondary_color, '#38bdf8'),
                'accent_tertiary',   COALESCE(accent_color, '#06b6d4'),
                'bg_primary',        COALESCE(background_color, '#04101f'),
                'bg_secondary',      COALESCE(surface_color, '#071828'),
                'text_primary',      COALESCE(text_primary_color, '#e0f2fe'),
                'text_secondary',    COALESCE(text_secondary_color, '#93c5fd'),
                'color_success',     COALESCE(success_color, '#10b981'),
                'color_warning',     COALESCE(warning_color, '#f59e0b'),
                'color_danger',      COALESCE(error_color, '#ef4444'),
                'color_info',        COALESCE(info_color, '#0ea5e9'),
                'font_family_body',  COALESCE(font_family, '''Inter'', sans-serif'),
                'font_size_base',    COALESCE(font_size_base, '14px'),
                'radius_md',         COALESCE(border_radius, '14px')
            )
            WHERE tokens IS NULL;
        `;
        await client.query(backfill);
        console.log('✅ Backfilled tokens from old flat columns');

        // 3. Drop old flat columns
        const dropCols = `
            ALTER TABLE themes
                DROP COLUMN IF EXISTS primary_color,
                DROP COLUMN IF EXISTS secondary_color,
                DROP COLUMN IF EXISTS accent_color,
                DROP COLUMN IF EXISTS background_color,
                DROP COLUMN IF EXISTS surface_color,
                DROP COLUMN IF EXISTS text_primary_color,
                DROP COLUMN IF EXISTS text_secondary_color,
                DROP COLUMN IF EXISTS success_color,
                DROP COLUMN IF EXISTS warning_color,
                DROP COLUMN IF EXISTS error_color,
                DROP COLUMN IF EXISTS info_color,
                DROP COLUMN IF EXISTS font_family,
                DROP COLUMN IF EXISTS font_size_base,
                DROP COLUMN IF EXISTS font_weight_base,
                DROP COLUMN IF EXISTS border_radius,
                DROP COLUMN IF EXISTS shadow_depth;
        `;
        await client.query(dropCols);
        console.log('✅ Old flat color columns dropped');

        // 4. Delete existing system default themes (will be re-seeded by NestJS)
        await client.query(`DELETE FROM themes WHERE is_system_default = true`);
        console.log('✅ Old system themes cleared — ready for re-seed via POST /v1/platform/themes/admin/seed');

        await client.query('COMMIT');
        console.log('🎉 Migration complete!');
        console.log('');
        console.log('Next step: call POST http://localhost:3000/v1/platform/themes/admin/seed');
        console.log('         to populate the 5 new premium themes.');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ Migration failed, rolled back:', err.message);
        process.exit(1);
    } finally {
        await client.end();
    }
}

migrate();
