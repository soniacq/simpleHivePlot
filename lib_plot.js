// lib_plot.js

var setup_plot = function(plot_info) {

  var g = plot_info.global;

  g.angle_dom = [], g.angle_rng = [];

  axes_info = plot_info.axes;
  for (var axis_name in axes_info) {
    axis_info = axes_info[axis_name];
    g.angle_dom.push(axis_name);
    g.angle_rng.push(axis_info.angle);
  }

  g.angle_f     = d3.scale.ordinal().domain(g.angle_dom).range(g.angle_rng);

  var radii     = [ g.inner_radius, g.outer_radius ]
  g.radius_f    = d3.scale.linear().range(radii);

  g.color_f     = d3.scale.category10();

  g.transform   = 'translate(' + g.x_off + ',' + g.y_off + ')';

  g.svg         = d3.select(g.selector + ' .chart')
                    .append('svg')
                      .attr('width',      g.x_max)
                      .attr('height',     g.y_max)
                      .append('g')
                        .attr('transform',  g.transform);

  // console.log('plot_info', plot_info); //T
};


var degrees = function(radians) { return radians / Math.PI * 180 - 90; }


var display_plot = function(plot_info) {

  var g = plot_info.global;

  // Set the radius domain.

  var index   = function(d) { return d.index; };

  var extent  = d3.extent(g.nodes, index);
  g.radius_f.domain(extent);


  // Draw the axes.

  var transform = function(d) {
    return 'rotate(' + degrees( g.angle_f(d.key) ) + ')';
  };

  var x1 = g.radius_f(0) - 10;
  var x2 = function(d) { return g.radius_f(d.count) + 10; };

  g.svg.selectAll('.axis')
    .data(g.nodesByType)
    .enter().append('line')
      .attr('class', 'axis')
      .attr('transform', transform)
      .attr('x1', x1)
      .attr('x2', x2);

  // Draw the links.

  var path_angle  = function(d) { return g.angle_f(d.type);    };
  var path_radius = function(d) { return g.radius_f(d.node.index); };

  g.svg.append('g')
    .attr('class', 'links')
    .selectAll('.link')
    .data(g.links)
    .enter().append('path')
      .attr('d', make_link().angle(path_angle).radius(path_radius) )
      .attr('class', 'link')
      .on('mouseover', on_mouseover_link)
      .on('mouseout',  on_mouseout);

  // Draw the nodes.  Note that each node can have up to two connectors,
  // representing the source (outgoing) and target (incoming) links.

  var connectors  = function(d) { return d.connectors; };
  var cx          = function(d) { return g.radius_f(d.node.index); };
  var fill        = function(d) { return g.color_f(d.packageName); };

  var transform   = function(d) {
    return 'rotate(' + degrees( g.angle_f(d.type) ) + ')';
  };

  g.svg.append('g')
    .attr('class', 'nodes')
    .selectAll('.node')
    .data(g.nodes)
    .enter().append('g')
      .attr('class', 'node')
      .style('fill', fill)
      .selectAll('ellipse')
      .data(connectors)
      .enter().append('ellipse')
        .attr('transform', transform)
        .attr('cx', cx)
        .attr('rx', 4)
        .attr('ry', 6)
        .on('mouseover', on_mouseover_node)
        .on('mouseout',  on_mouseout);
};



// lib_link.js
//
// A shape generator for Hive links, based on a source and a target.
// The source and target are defined in polar coordinates (angle and radius).
// Ratio links can also be drawn by using a startRadius and endRadius.
// This class is modeled after d3.svg.chord.

function make_link() {

    var source      = function(d) { return d.source; },
        target      = function(d) { return d.target; },
        angle       = function(d) { return d.angle;  },
        startRadius = function(d) { return d.radius; },
        endRadius   = startRadius,
        arcOffset   = -Math.PI / 2;


    function link(d, i) {

        var s   = node(source, this, d, i),
            t   = node(target, this, d, i),
            x;

        d.ib_edge = t.a < s.a;

        if (d.ib_edge) x = t, t = s, s = x;

        if (t.a - s.a > Math.PI) s.a += 2 * Math.PI;

        var a1      = s.a + (t.a - s.a) / 3,
            a2      = t.a - (t.a - s.a) / 3,
            cos_a1  = Math.cos(a1),     sin_a1  = Math.sin(a1),
            cos_a2  = Math.cos(a2),     sin_a2  = Math.sin(a2),
            cos_sa  = Math.cos(s.a),    sin_sa  = Math.sin(s.a),
            cos_ta  = Math.cos(t.a),    sin_ta  = Math.sin(t.a);

        if (s.r0 - s.r1 || t.r0 - t.r1) {
            return  'M' + cos_sa * s.r0 + ',' + sin_sa * s.r0 +
                'L' + cos_sa * s.r1 + ',' + sin_sa * s.r1 +
                'C' + cos_a1 * s.r1 + ',' + sin_a1 * s.r1 +
                ' ' + cos_a2 * t.r1 + ',' + sin_a2 * t.r1 +
                ' ' + cos_ta * t.r1 + ',' + sin_ta * t.r1 +
                'L' + cos_ta * t.r0 + ',' + sin_ta * t.r0 +
                'C' + cos_a2 * t.r0 + ',' + sin_a2 * t.r0 +
                ' ' + cos_a1 * s.r0 + ',' + sin_a1 * s.r0 +
                ' ' + cos_sa * s.r0 + ',' + sin_sa * s.r0;
        } else {
            return  'M' + cos_sa * s.r0 + ',' + sin_sa * s.r0 +
                'C' + cos_a1 * s.r1 + ',' + sin_a1 * s.r1 +
                ' ' + cos_a2 * t.r1 + ',' + sin_a2 * t.r1 +
                ' ' + cos_ta * t.r1 + ',' + sin_ta * t.r1;
        }
    }


    function node(method, thiz, d, i) {

        var node  = method.call(thiz, d, i),
            a     = +(typeof angle       === 'function'
                    ? angle.call(thiz, node, i)
                    : angle) + arcOffset,
            r0    = +(typeof startRadius === 'function'
                ? startRadius.call(thiz, node, i)
                : startRadius),
            r1t   = +(typeof endRadius   === 'function'
                ? endRadius.call(thiz, node, i)
                : endRadius),
            r1    = startRadius === endRadius ? r0 : r1t;

        return { r0: r0, r1: r1, a: a };
    }


    function make_func(object, method) {

        eval(object + '.' + method + "= function(_) {\n" +
        '  if (!arguments.length) return ' + method + ";\n" +
        '    ' + method + "= _;\n" +
        '    return ' + object + ";\n};\n" );
    }

    make_func('link', 'source');
    make_func('link', 'target');
    make_func('link', 'angle');
    make_func('link', 'startRadius');
    make_func('link', 'endRadius');

    link.radius = function(_) {
        if (!arguments.length) return startRadius;
        startRadius = endRadius = _;
        return link;
    };

    return link;
}
