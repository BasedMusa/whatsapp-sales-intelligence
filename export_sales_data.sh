#!/bin/bash

# Export Sales Analysis Report from PostgreSQL Database
# This script provides multiple export formats with proper JSONB handling

echo "📊 WhatsApp Sales Analysis Report Export Tool"
echo "============================================="

# Database connection details
DB_HOST="postgres"
DB_NAME="evolution_db"
DB_USER="postgres"
export PGPASSWORD="password"

# Export directory
EXPORT_DIR="/Users/musa/DataClassification/exports"
mkdir -p "$EXPORT_DIR"

# Get current timestamp for filename
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

echo ""
echo "Select export format:"
echo "1) SQL dump (preserves JSONB as-is)"
echo "2) CSV with JSONB as JSON strings"
echo "3) CSV with JSONB fields expanded"
echo "4) JSON export (complete data structure)"
echo "5) Excel-friendly CSV (JSONB simplified)"
read -p "Enter choice (1-5): " choice

case $choice in
    1)
        echo "📦 Exporting as SQL dump..."
        docker exec postgres pg_dump \
            -h localhost \
            -U postgres \
            -d evolution_db \
            -t '"SalesAnalysisReport"' \
            --data-only \
            --inserts \
            > "$EXPORT_DIR/sales_analysis_${TIMESTAMP}.sql"
        echo "✅ SQL export complete: $EXPORT_DIR/sales_analysis_${TIMESTAMP}.sql"
        ;;

    2)
        echo "📄 Exporting as CSV with JSONB as strings..."
        docker exec postgres psql -h localhost -U postgres -d evolution_db -c "\COPY (
            SELECT
                \"remoteJid\",
                analysis_time,
                product_category,
                specific_products::text as specific_products_json,
                product_models::text as product_models_json,
                quantity_mentioned,
                primary_sales_agent,
                additional_agents::text as additional_agents_json,
                agent_handoff_detected,
                lead_stage,
                next_action_required,
                sales_status,
                customer_objections::text as customer_objections_json,
                urgency_level,
                customer_name,
                customer_location,
                budget_range,
                purchase_timeline,
                decision_maker_status,
                product_specifications::text as product_specifications_json,
                accessories_discussed::text as accessories_discussed_json,
                warranty_service_needs,
                color_preferences::text as color_preferences_json,
                lead_source,
                competitive_products::text as competitive_products_json,
                upsell_opportunities::text as upsell_opportunities_json,
                customer_sentiment,
                pain_points_identified::text as pain_points_identified_json,
                pricing_discussed,
                demo_scheduled,
                follow_up_required,
                total_messages,
                conversation_duration_days,
                last_customer_message_time,
                analysis_confidence,
                ai_model_used,
                processing_time_ms
            FROM \"SalesAnalysisReport\"
            ORDER BY analysis_time DESC
        ) TO '/tmp/sales_analysis_${TIMESTAMP}.csv' WITH CSV HEADER"

        docker cp postgres:/tmp/sales_analysis_${TIMESTAMP}.csv "$EXPORT_DIR/"
        echo "✅ CSV export complete: $EXPORT_DIR/sales_analysis_${TIMESTAMP}.csv"
        ;;

    3)
        echo "📊 Exporting as CSV with expanded JSONB fields..."
        docker exec postgres psql -h localhost -U postgres -d evolution_db -c "\COPY (
            SELECT
                \"remoteJid\",
                analysis_time,
                product_category,
                array_to_string(ARRAY(SELECT jsonb_array_elements_text(specific_products)), '; ') as specific_products,
                array_to_string(ARRAY(SELECT jsonb_array_elements_text(product_models)), '; ') as product_models,
                quantity_mentioned,
                primary_sales_agent,
                array_to_string(ARRAY(SELECT jsonb_array_elements_text(additional_agents)), '; ') as additional_agents,
                agent_handoff_detected,
                lead_stage,
                next_action_required,
                sales_status,
                array_to_string(ARRAY(SELECT jsonb_array_elements_text(customer_objections)), '; ') as customer_objections,
                urgency_level,
                customer_name,
                customer_location,
                budget_range,
                purchase_timeline,
                decision_maker_status,
                product_specifications::text as product_specifications,
                array_to_string(ARRAY(SELECT jsonb_array_elements_text(accessories_discussed)), '; ') as accessories_discussed,
                warranty_service_needs,
                array_to_string(ARRAY(SELECT jsonb_array_elements_text(color_preferences)), '; ') as color_preferences,
                lead_source,
                array_to_string(ARRAY(SELECT jsonb_array_elements_text(competitive_products)), '; ') as competitive_products,
                array_to_string(ARRAY(SELECT jsonb_array_elements_text(upsell_opportunities)), '; ') as upsell_opportunities,
                customer_sentiment,
                array_to_string(ARRAY(SELECT jsonb_array_elements_text(pain_points_identified)), '; ') as pain_points,
                pricing_discussed,
                demo_scheduled,
                follow_up_required,
                total_messages,
                conversation_duration_days,
                last_customer_message_time,
                analysis_confidence,
                ai_model_used,
                processing_time_ms
            FROM \"SalesAnalysisReport\"
            ORDER BY analysis_time DESC
        ) TO '/tmp/sales_analysis_expanded_${TIMESTAMP}.csv' WITH CSV HEADER"

        docker cp postgres:/tmp/sales_analysis_expanded_${TIMESTAMP}.csv "$EXPORT_DIR/"
        echo "✅ Expanded CSV export complete: $EXPORT_DIR/sales_analysis_expanded_${TIMESTAMP}.csv"
        ;;

    4)
        echo "🗂️ Exporting as JSON..."
        docker exec postgres psql -h localhost -U postgres -d evolution_db -t -c "
            SELECT json_agg(row_to_json(t))
            FROM (
                SELECT * FROM \"SalesAnalysisReport\"
                ORDER BY analysis_time DESC
            ) t
        " > "$EXPORT_DIR/sales_analysis_${TIMESTAMP}.json"
        echo "✅ JSON export complete: $EXPORT_DIR/sales_analysis_${TIMESTAMP}.json"
        ;;

    5)
        echo "📈 Exporting Excel-friendly CSV..."
        docker exec postgres psql -h localhost -U postgres -d evolution_db -c "\COPY (
            SELECT
                \"remoteJid\" as whatsapp_number,
                analysis_time::date as date_analyzed,
                product_category,
                COALESCE(jsonb_array_length(specific_products), 0) as products_discussed_count,
                array_to_string(ARRAY(SELECT jsonb_array_elements_text(specific_products)), ', ') as products_list,
                quantity_mentioned as quantity,
                primary_sales_agent as agent,
                lead_stage,
                urgency_level,
                CASE
                    WHEN follow_up_required THEN 'Yes'
                    ELSE 'No'
                END as needs_followup,
                customer_name,
                customer_location,
                budget_range,
                purchase_timeline,
                customer_sentiment,
                CASE
                    WHEN pricing_discussed THEN 'Yes'
                    ELSE 'No'
                END as price_discussed,
                CASE
                    WHEN demo_scheduled THEN 'Yes'
                    ELSE 'No'
                END as demo_scheduled,
                total_messages,
                conversation_duration_days as days_active,
                ROUND(analysis_confidence * 100)::integer as confidence_percent
            FROM \"SalesAnalysisReport\"
            WHERE product_category != 'No Product Mentioned'
            ORDER BY analysis_time DESC
        ) TO '/tmp/sales_analysis_excel_${TIMESTAMP}.csv' WITH CSV HEADER"

        docker cp postgres:/tmp/sales_analysis_excel_${TIMESTAMP}.csv "$EXPORT_DIR/"
        echo "✅ Excel-friendly CSV export complete: $EXPORT_DIR/sales_analysis_excel_${TIMESTAMP}.csv"
        ;;

    *)
        echo "❌ Invalid choice"
        exit 1
        ;;
esac

# Show export statistics
echo ""
echo "📊 Export Statistics:"
docker exec postgres psql -h localhost -U postgres -d evolution_db -t -c "
    SELECT
        'Total Records: ' || COUNT(*) || E'\n' ||
        'Date Range: ' || MIN(analysis_time)::date || ' to ' || MAX(analysis_time)::date || E'\n' ||
        'Top Category: ' || (
            SELECT product_category || ' (' || COUNT(*) || ' records)'
            FROM \"SalesAnalysisReport\"
            WHERE product_category != 'No Product Mentioned'
            GROUP BY product_category
            ORDER BY COUNT(*) DESC
            LIMIT 1
        )
    FROM \"SalesAnalysisReport\"
"

echo ""
echo "✅ Export completed successfully!"
echo "📁 Files saved in: $EXPORT_DIR"