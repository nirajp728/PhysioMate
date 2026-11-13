import io
import os

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.ticker import MaxNLocator
from jinja2 import Environment, FileSystemLoader

matplotlib.rcParams["svg.fonttype"] = "path"  # text drawn as shapes, so no font files needed
INK, BLUE, CORAL, GREEN, SAGE = "#11141a", "#6e9bff", "#ff7a59", "#3fae6b", "#bfd2af"


def _style(ax):
    ax.spines[["top", "right"]].set_visible(False)
    ax.tick_params(labelsize=8)
    ax.grid(axis="y", color="#e3dfd1", lw=0.6)


def angle_plot(ax, series, cal):
    if series:
        ax.plot([t / 60 for t, _ in series], [a for _, a in series], color=BLUE, lw=1.2)
    else:
        ax.text(0.5, 0.5, "no data", ha="center", transform=ax.transAxes)
    if cal:
        ax.axhspan(cal["min_angle"], cal["max_angle"], color=SAGE, alpha=0.3)
        ax.axhline(cal["max_angle"], color=CORAL, ls="--", lw=1)
        ax.axhline(cal["min_angle"], color=CORAL, ls="--", lw=1)
    ax.set_xlabel("Time (min)", fontsize=8)
    ax.set_ylabel("Elbow angle (\u00b0)", fontsize=8)
    _style(ax)


def rom_plot(ax, roms, avg):
    if roms:
        ax.bar(range(1, len(roms) + 1), roms, color=GREEN)
        ax.axhline(avg, color=INK, ls="--", lw=1)
    else:
        ax.text(0.5, 0.5, "no completed reps", ha="center", transform=ax.transAxes)
    ax.set_xlabel("Repetition", fontsize=8)
    ax.set_ylabel("ROM (\u00b0)", fontsize=8)
    ax.xaxis.set_major_locator(MaxNLocator(integer=True))
    _style(ax)


def angle_fig(series, cal):
    fig, ax = plt.subplots(figsize=(7.4, 2.5))
    angle_plot(ax, series, cal)
    return fig


def rom_fig(roms, avg):
    fig, ax = plt.subplots(figsize=(3.6, 2.5))
    rom_plot(ax, roms, avg)
    return fig


def _svg(fig):
    buf = io.StringIO()
    fig.savefig(buf, format="svg", bbox_inches="tight")
    plt.close(fig)
    s = buf.getvalue()
    return s[s.index("<svg"):]


def _weasy_pdf(ctx):
    from weasyprint import HTML  # needs Pango; see README if this import fails on Windows

    env = Environment(loader=FileSystemLoader(os.path.dirname(__file__)), autoescape=True)
    html = env.get_template("template.html").render(
        **ctx,
        angle_chart=_svg(angle_fig(ctx["series"], ctx["m"]["calibration"])),
        rom_chart=_svg(rom_fig(ctx["m"]["rom_per_rep"], ctx["m"]["avg_rom"])))
    return HTML(string=html).write_pdf()


def _matplotlib_pdf(ctx):
    """Fallback when WeasyPrint is not installed: the same one page drawn with matplotlib only."""
    m = ctx["m"]
    fig = plt.figure(figsize=(8.27, 11.69))
    fig.patch.set_facecolor("white")
    fig.add_artist(plt.Rectangle((0.04, 0.925), 0.92, 0.055, transform=fig.transFigure, color=INK))
    fig.text(0.06, 0.953, "Rehab session report", color="#f7f4ec", fontsize=16, weight="bold", va="center")
    fig.text(0.94, 0.953, f"{ctx['patient']}  |  {ctx['date']}", color=SAGE, fontsize=9, ha="right", va="center")
    kpis = [("Max angle", f"{m['max_angle']:.0f}°"), ("Min angle", f"{m['min_angle']:.0f}°"),
            ("Range of motion", f"{m['rom']:.0f}°"), ("Repetitions", str(m["reps"]))]
    for i, (k, v) in enumerate(kpis):
        x = 0.04 + i * 0.235
        fig.add_artist(plt.Rectangle((x, 0.84), 0.215, 0.065, transform=fig.transFigure, color="#f7f4ec"))
        fig.text(x + 0.012, 0.893, k, fontsize=8, color="#555")
        fig.text(x + 0.012, 0.852, v, fontsize=18, weight="bold")
    ax1 = fig.add_axes([0.09, 0.57, 0.86, 0.22])
    ax1.set_title("Elbow angle over the session", fontsize=10, loc="left")
    angle_plot(ax1, ctx["series"], m["calibration"])
    ax2 = fig.add_axes([0.09, 0.30, 0.38, 0.19])
    ax2.set_title("Range of motion per repetition", fontsize=10, loc="left")
    rom_plot(ax2, m["rom_per_rep"], m["avg_rom"])
    rows = [("Game score", m["score"]), ("Average ROM per rep", f"{m['avg_rom']:.1f}°"),
            ("Fatigue (first vs last third)", f"{m['fatigue_pct']}%" if m["fatigue_pct"] is not None else "n/a"),
            ("Change vs last session (ROM)", f"{m['rom'] - ctx['prev_rom']:+.0f}°" if ctx["prev_rom"] is not None else "first session"),
            ("Data received", f"{m['coverage_pct']}%")]
    ax3 = fig.add_axes([0.54, 0.30, 0.41, 0.19])
    ax3.axis("off")
    ax3.set_title("Key numbers", fontsize=10, loc="left")
    t = ax3.table(cellText=[[a, str(b)] for a, b in rows], colLabels=["Metric", "Value"], loc="upper center", cellLoc="left", colWidths=[0.7, 0.3])
    t.auto_set_font_size(False)
    t.set_fontsize(8)
    t.scale(1, 1.5)
    from textwrap import fill
    fig.text(0.06, 0.2, "Summary", fontsize=10, weight="bold")
    fig.text(0.06, 0.18, fill(ctx["text"], 100), fontsize=9, va="top")
    fig.text(0.06, 0.03, f"Generated automatically on {ctx['generated']}. Not a medical diagnosis.", fontsize=7, color="#888")
    buf = io.BytesIO()
    fig.savefig(buf, format="pdf")
    plt.close(fig)
    return buf.getvalue()


def build_pdf(ctx):
    try:
        return _weasy_pdf(ctx)
    except (ImportError, OSError) as e:  # WeasyPrint or its Pango libraries missing
        print("[reports] WeasyPrint unavailable, using matplotlib fallback:", e)
        return _matplotlib_pdf(ctx)
