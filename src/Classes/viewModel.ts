import * as d3 from "d3";
import powerbi from "powerbi-visuals-api";
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import chartObject from "./chartObject"
import settingsObject from "./settingsObject";
import dataObject from "./dataObject";
import lineData from "./lineData"
import controlLimits from "./controlLimits";
import plotData from "./plotData"
import checkInvalidDataView from "../Functions/checkInvalidDataView"
import buildTooltip from "../Functions/buildTooltip"
import axisLimits from "./axisLimits"

type nestReturnT = {
  key: string;
  values: any;
  value: undefined;
}

class viewModelObject {
  inputData: dataObject;
  inputSettings: settingsObject;
  chartBase: chartObject;
  calculatedLimits: controlLimits;
  plotPoints: plotData[];
  groupedLines: [string, lineData[]][];
  anyHighlights: boolean;
  axisLimits: axisLimits;
  displayPlot: boolean;
  percentLabels: boolean;
  tickLabels: { x: number; label: string; }[];

  getPlotData(): plotData[] {
    let plotPoints = new Array<plotData>();
    let tickLabels = new Array<{ x: number; label: string; }>();

    for (let i: number = 0; i < this.calculatedLimits.keys.length; i++) {
      let index: number = this.calculatedLimits.keys[i].x;
      let dot_colour: string = this.inputSettings.scatter.colour.value;
      if (this.calculatedLimits.shift[i]) {
        dot_colour = this.inputSettings.outliers.shift_colour.value;
      }
      if (this.calculatedLimits.trend[i]) {
        dot_colour = this.inputSettings.outliers.trend_colour.value;
      }
      if (this.calculatedLimits.two_in_three[i]) {
        dot_colour = this.inputSettings.outliers.twointhree_colour.value;
      }
      if (this.calculatedLimits.astpoint[i]) {
        dot_colour = this.inputSettings.outliers.ast_colour.value;
      }
      plotPoints.push({
        x: index,
        value: this.calculatedLimits.values[i],
        colour: dot_colour,
        identity: null,
        highlighted: this.inputData.highlights ? (this.inputData.highlights[index] ? true : false) : false,
        tooltip: buildTooltip({date: this.calculatedLimits.keys[i].label,
                                value: this.calculatedLimits.values[i],
                                numerator: this.calculatedLimits.numerators ? this.calculatedLimits.numerators[i] : null,
                                denominator: this.calculatedLimits.denominators ? this.calculatedLimits.denominators[i] : null,
                                target: this.calculatedLimits.targets[i],
                                limits: {
                                  ll99: this.calculatedLimits.ll99 ? this.calculatedLimits.ll99[i] : null,
                                  ul99: this.calculatedLimits.ll99 ? this.calculatedLimits.ul99[i] : null
                                },
                                chart_type: this.inputData.chart_type,
                                multiplier: this.inputData.multiplier,
                                prop_labels: this.percentLabels,
                               astpoint: this.calculatedLimits.astpoint[i],
                               trend: this.calculatedLimits.trend[i],
                               shift: this.calculatedLimits.shift[i],
                               two_in_three: this.calculatedLimits.two_in_three[i]})
      })
      tickLabels.push({x: index, label: this.calculatedLimits.keys[i].label});
    }
    this.tickLabels = tickLabels;
    return plotPoints;
  }

  getGroupedLines(): [string, lineData[]][] {
    let labels: string[] = ["ll99", "ll95", "ul95", "ul99", "targets", "values"];

    let formattedLines: lineData[] = new Array<lineData>();
    let nLimits = this.calculatedLimits.keys.length;

    for (let i: number = 0; i < nLimits; i++) {
      labels.forEach(label => {
        formattedLines.push({
          x: this.calculatedLimits.keys[i].x,
          line_value: this.calculatedLimits[label] ? this.calculatedLimits[label][i] : null,
          group: label
        })
      })
    }
    return d3.groups(formattedLines, d => d.group);
  }

  constructor(args: { options: VisualUpdateOptions;
                      inputSettings: settingsObject;
                      host: IVisualHost; }) {

    let dv: powerbi.DataView[] = args.options.dataViews;
    console.log("before invalid")
    if (checkInvalidDataView(dv)) {
      this.inputData = new dataObject({empty: true});
      this.inputSettings = args.inputSettings;
      this.chartBase = null;
      this.calculatedLimits = null;
      this.plotPoints = [new plotData({ empty: true })];
      this.groupedLines = <[string, lineData[]][]>null;
      this.anyHighlights = null;
      this.axisLimits = new axisLimits({ empty: true })
      this.displayPlot = false
    console.log("after invalid - a")
      return;
    }
    console.log("after invalid - b")

    this.inputData = new dataObject({ inputView: dv[0].categorical,
                                      inputSettings: args.inputSettings})
    console.log("Initialised data")
    this.inputSettings = args.inputSettings;
    this.anyHighlights = this.inputData.highlights ? true : false;
    this.chartBase = new chartObject({ inputData: this.inputData,
                                        inputSettings: this.inputSettings});
    this.percentLabels = ["p", "pp"].includes(this.inputData.chart_type)
                            && this.inputData.multiplier == 1;
    console.log("Initialised chart")
    this.calculatedLimits = this.chartBase.getLimits();
    console.log(this.calculatedLimits)
    this.plotPoints = this.getPlotData();
    console.log("Got plot data")
    this.plotPoints.forEach((point, idx) => {
      point.identity = args.host
                            .createSelectionIdBuilder()
                            .withCategory(this.inputData.categories,
                                            this.inputData.keys[idx].id)
                            .createSelectionId()
    })
    this.groupedLines = this.getGroupedLines();
    console.log("Grouped lines for plotting")
    this.axisLimits = new axisLimits({ inputData: this.inputData,
                                        inputSettings: this.inputSettings,
                                        calculatedLimits: this.calculatedLimits });
    console.log("Made axis limits")
    this.displayPlot = this.plotPoints.length > 1;
  }
}

export default viewModelObject