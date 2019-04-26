import React, { Component } from 'react';
import * as d3 from 'd3';
import * as topojson from "topojson-client";
import Select2 from 'react-select2-wrapper';
import 'react-select2-wrapper/css/select2.css';
import '../css/geomap.css'
import $ from 'jquery';

class MapaGeografico extends Component {

  state = {
    br: {},
    analfabestimo: {},
    select2: []
  }

  locale = {
    decimal: ",",
    thousands: ".",
    grouping: [3],
    currency: ["R$", ""]
  }

  color = d3.scaleQuantize().domain([0, 40]).range(d3.schemeReds[9]);

  getData() {
    if (!("objects" in this.state.br)) {
      Promise.all([
        d3.json("/brasil_estados_cidades_topo.json"),
        d3.csv("/analfabetismo_municipios_brasil_2010.csv", ({ Município, rate, codigo_uf }) => [codigo_uf + '-' + Município, +rate]),
      ]).then(([br, analfabestimo]) => {


        this.states = new Map(br.objects.states.geometries.map(d => [d.id, d.properties]));

        this.cities = new Map(br.objects.cities.geometries.map(d => [d.id, d.properties]))

        let select2 = []

        this.states.forEach((valor, chave, mapa) => {
          let node = {
            text: valor.name,
            id: chave
          }
          select2.push(node);
        });

        select2 = select2.sort((a, b) => a.text.localeCompare(b.text));

        this.setState({
          br: br,
          analfabestimo: analfabestimo,
          select2: select2
        });

      }).catch(err => console.log('Error loading or parsing data.'));
    }
  }

  legend(g) {

    const x = d3.scaleLinear()
      .domain(d3.extent(this.color.domain()))
      .rangeRound([0, 260]);

    g.selectAll("rect")
      .data(this.color.range().map(d => this.color.invertExtent(d)))
      .join("rect")
      .attr("height", 8)
      .attr("x", d => x(d[0]))
      .attr("width", d => x(d[1]) - x(d[0]))
      .attr("fill", d => this.color(d[0]));

    g.append("text")
      .attr("x", x.range()[0])
      .attr("y", -6)
      .attr("fill", "currentColor")
      .attr("text-anchor", "start")
      .attr("font-weight", "bold")
      .text(this.data.title);

    g.call(d3.axisBottom(x)
      .tickSize(13)
      .tickFormat(d => this.format(d))
      .tickValues(this.color.range().slice(1).map(d => this.color.invertExtent(d)[0])))
      .select(".domain")
      .remove();
  }

  drawChart(state) {

    this.active = d3.select(null);

    let { br, analfabestimo } = state;

    if ("objects" in br) {

      this.data = Object.assign(new Map(analfabestimo), { title: "Taxa de Analfabetismo (%) em 2010" });

      this.format = d3.formatDefaultLocale(this.locale).format(".1f");

      this.svg = d3.select("svg.mapa")
        .on("click", this.reset)
        .style("width", "100%");

      console.log(this.svg.select(function() { return this.parentNode}));

      let width = this.svg.attr('width');
      let height = this.svg.attr('height');

      this.deltax = 1000;

      var projection = d3.geoMercator()
        .scale(800)
        .translate([width / 2 + this.deltax, height / 2 - 200]);

      this.path = d3.geoPath().projection(projection);

      // this.path = d3.geoPath();

      const gcities = this.svg.append("g")
        .attr("id", "gcities");;

      gcities.selectAll("path")
        .data(topojson.feature(br, br.objects.cities).features)
        .join("path")
        .attr("fill", d => this.color(this.data.get(`${d.id.slice(0, 2)}-${d.properties.name}`)))
        .attr("stroke", "none")
        .attr("class", "feature")
        //.attr("stroke-width", 0.005)
        .attr("d", this.path)
        .attr("id", d => d.id)
        .on("click", this.clicked())
        .append("title")
        .text(d => `${d.properties.name}, ${this.states.get(d.id.slice(0, 2)).name}
${isNaN(this.data.get(`${d.id.slice(0, 2)}-${d.properties.name}`)) ? 'Não disponível' : `${this.format(this.data.get(`${d.id.slice(0, 2)}-${d.properties.name}`))}%`}`);

      const gstates = this.svg.append("g")
        .attr("id", "gstates");

      gstates.selectAll("path")
        .data(topojson.feature(br, br.objects.states).features)
        .join("path")
        .attr("fill", "gray")
        .attr("stroke", "black")
        .attr("id", d => `estado_${d.id}`)
        .attr("stroke-width", 0.3)
        .on("click", this.clicked())
        .attr("stroke-linejoin", "round")
        .attr("fill-opacity", 0)
        .attr("d", this.path)
        .append("title")
        .text(d => d.properties.name);

      this.zoom = d3.zoom()
        .on("zoom", () => {
          this.zoomed = true;
          d3.select('#reset_button')
            .attr("display", "block");
          gstates.attr("transform", d3.event.transform);
          gcities.attr("transform", d3.event.transform);
        });

      this.svg.append("g")
        .attr("transform", "translate(700, 30) scale(1.5)")
        .call(this.legend.bind(this));

      const greset = this.svg.append("g")
        .attr("id", "reset_button")
        .attr("display", "none")
        .attr("transform", "translate(1200, 550)")

      greset.append("circle")
        .attr("r", "15px")
        .attr("fill", "white")
        .attr("stroke", "gray")
        .attr("stroke-width", 0.5)
        .attr("cursor", "pointer")
        .attr("cx", 12)
        .attr("cy", 12)
        .on("click", this.reset.bind(this));

      greset.append("path")
        .attr("cursor", "pointer")
        .on("click", this.reset.bind(this))
        .attr("d", "M14 12c0-1.1-.9-2-2-2s-2 .9-2 2 .9 2 2 2 2-.9 2-2zm-2-9c-4.97 0-9 4.03-9 9H0l4 4 4-4H5c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.51 0-2.91-.49-4.06-1.3l-1.42 1.44C8.04 20.3 9.94 21 12 21c4.97 0 9-4.03 9-9s-4.03-9-9-9z")

      this.svg.call(this.zoom);

    }
  }

  clicked() {

    let that = this;

    return function (d) {

      console.log("that");
      console.log(that);
      console.log("this");
      console.log(this);
      console.log("d")
      console.log(d)

      if (that.active.node() === this) return that.reset();
      that.active.classed("active", false);
      that.active = d3.select(this).classed("active", true);

      const path = d3.select(this);

      if (path.attr("id").includes("estado")) {

        d3.select("#gstates")
          .selectAll("path")
          .attr("fill", "gray")
          .attr("fill-opacity", 0.5);

        path.attr("fill", "none");
        console.log("clicou num estado");
      }

      console.log("d.properties.name");
      console.log(d.properties.name);

      let width = that.svg.attr('width');
      let height = that.svg.attr('height');

      var bounds = that.path.bounds(d),
        dx = bounds[1][0] - bounds[0][0],
        dy = bounds[1][1] - bounds[0][1],
        x = (bounds[0][0] + bounds[1][0]) / 2,
        y = (bounds[0][1] + bounds[1][1]) / 2,
        scale = Math.max(1, Math.min(35, 0.9 / Math.max(dx / width, dy / height))) * .9,
        translate = [width / 2 + that.deltax / 2 - 200 - scale * x, height / 2 - scale * y + 30];

      that.svg.transition()
        .duration(750)
        .call(that.zoom.transform, d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale));
    }
  }

  reset() {
    if (this.active) {
      this.active.classed("active", false);
      this.active = d3.select(null);
      d3.select("#gstates")
        .selectAll("path")
        .attr("fill", "gray")
        .attr("fill-opacity", 0);

      this.svg.transition()
        .duration(750)
        .call(this.zoom.transform, d3.zoomIdentity);
    } else {

    }
    d3.select('#reset_button')
      .attr("display", "none");
  }

  componentDidMount() {
    this.getData();
  }

  select(e) {
    let selected = $("#estados").find(':selected');
    if (selected[0]) {
      let id = selected[0].value;
      // console.log(id);
      let prefix = "municipio";
      if (id < 100) prefix = "estado";
      id = `#${prefix}_${id}`;
      console.log(id);
      var ev = document.createEvent("SVGEvents");
      ev.initEvent("click", true, true);
      $(id)[0].dispatchEvent(ev);
    }
  }

  render() {
    return (
      <div>
        <Select2 id="estados" ref="tags" style={{ width: '200px' }}
          data={this.state.select2}
          onChange={this.select.bind(this)}
          options={{
            placeholder: 'Selecione o estado',
          }} />
        <svg className="mapa" width="800" height="600"></svg>
        {this.drawChart(this.state)}
      </div>
    );

  }

}

export default MapaGeografico;