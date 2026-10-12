import io
import datetime
import urllib.parse
from fastapi import APIRouter, HTTPException, Response
from app.schemas.schemas import ExportRequest
from app.services.export_service import (
    generate_pptx_report,
    generate_docx_report,
    generate_xlsx_report,
    generate_pdf_report,
    generate_chart_png
)

router = APIRouter(prefix="/export", tags=["Document Export Services"])

def get_clean_filename(base_title: str, extension: str) -> str:
    clean_name = "".join(c if c.isalnum() or c in ("-", "_") else "_" for c in base_title.strip())
    clean_name = clean_name[:50] or "InsightFlow_Report"
    date_str = datetime.datetime.now().strftime("%Y%m%d_%H%M")
    return f"{clean_name}_{date_str}.{extension}"

@router.post("/generate")
def export_document(req: ExportRequest):
    fmt = req.format.lower().strip()
    base_title = req.title or "InsightFlow_Intelligence_Report"

    # Extract tables from canvas if none explicitly provided
    tables = req.tables or []
    if not tables and req.canvas and isinstance(req.canvas, dict):
        components = req.canvas.get("components", [])
        for comp in components:
            if comp.get("type") == "data_table" and isinstance(comp.get("props"), dict):
                props = comp["props"]
                if "columns" in props and "data" in props:
                    tables.append({
                        "title": comp.get("title", "Canvas Data Table"),
                        "columns": props["columns"],
                        "rows": props["data"]
                    })

    # Extract KPIs from canvas if none explicitly provided
    kpis = req.kpis or []
    if not kpis and req.canvas and isinstance(req.canvas, dict):
        components = req.canvas.get("components", [])
        for comp in components:
            if comp.get("type") == "kpi_card" and isinstance(comp.get("props"), dict):
                props = comp["props"]
                kpis.append({
                    "title": props.get("title", comp.get("title", "Metric")),
                    "value": props.get("value", 0),
                    "formatted_value": props.get("formatted_value") or str(props.get("value", "")),
                    "trend": props.get("trend", "neutral"),
                    "period_label": props.get("period_label", "")
                })

    try:
        if fmt in ["pptx", "powerpoint"]:
            buf = generate_pptx_report(
                title=req.title,
                subtitle=req.subtitle,
                summary=req.summary,
                kpis=kpis,
                insights=req.insights,
                tables=tables,
                recommendations=req.recommendations,
                sources=req.sources
            )
            media_type = "application/vnd.openxmlformats-officedocument.presentationml.presentation"
            filename = get_clean_filename(base_title, "pptx")

        elif fmt in ["docx", "word"]:
            buf = generate_docx_report(
                title=req.title,
                subtitle=req.subtitle,
                summary=req.summary,
                kpis=kpis,
                insights=req.insights,
                tables=tables,
                recommendations=req.recommendations,
                sources=req.sources
            )
            media_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            filename = get_clean_filename(base_title, "docx")

        elif fmt in ["xlsx", "excel"]:
            buf = generate_xlsx_report(
                title=req.title,
                subtitle=req.subtitle,
                summary=req.summary,
                kpis=kpis,
                tables=tables,
                recommendations=req.recommendations,
                sources=req.sources
            )
            media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            filename = get_clean_filename(base_title, "xlsx")

        elif fmt in ["pdf"]:
            buf = generate_pdf_report(
                title=req.title,
                subtitle=req.subtitle,
                summary=req.summary,
                kpis=kpis,
                insights=req.insights,
                tables=tables,
                recommendations=req.recommendations,
                sources=req.sources
            )
            media_type = "application/pdf"
            filename = get_clean_filename(base_title, "pdf")

        elif fmt in ["png", "chart"]:
            cfg = req.chart_config or {}
            c_type = cfg.get("type", "bar")
            c_data = cfg.get("data", [])
            x_k = cfg.get("x_key", "category")
            y_ks = cfg.get("y_keys", ["value"])

            # Fallback if no chart_config provided: look for chart in canvas
            if not c_data and req.canvas and isinstance(req.canvas, dict):
                components = req.canvas.get("components", [])
                for comp in components:
                    if comp.get("type") in ["bar_chart", "line_chart"]:
                        props = comp.get("props", {})
                        c_type = "line" if comp.get("type") == "line_chart" else "bar"
                        c_data = props.get("data", [])
                        x_k = props.get("categoryKey", props.get("xKey", "period"))
                        y_ks = [props.get("dataKey", props.get("yKey", "revenue"))]
                        break

            if not c_data:
                c_data = [{"label": "Metric", "value": 100}]
                x_k = "label"
                y_ks = ["value"]

            buf = generate_chart_png(
                chart_type=c_type,
                title=req.title,
                data=c_data,
                x_key=x_k,
                y_keys=y_ks
            )
            media_type = "image/png"
            filename = get_clean_filename(base_title, "png")

        else:
            raise HTTPException(status_code=400, detail=f"Unsupported export format '{fmt}'. Choose from pptx, docx, xlsx, pdf, png.")

        return Response(
            content=buf.getvalue(),
            media_type=media_type,
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
                "Access-Control-Expose-Headers": "Content-Disposition"
            }
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Export document generation failed: {str(e)}")
