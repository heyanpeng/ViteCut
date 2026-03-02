import { jsx as Ee, jsxs as Et, Fragment as sr } from "react/jsx-runtime";
import * as le from "react";
import Jt, { cloneElement as Bi, useRef as Ae, useEffect as Qe, useImperativeHandle as ar, useState as wt, useLayoutEffect as lr, useCallback as pt, createElement as Ks } from "react";
class Zs {
  constructor(i) {
    this.events = {}, this.events = i.handlers;
  }
  on(i, r) {
    return (i instanceof Array ? i : i.split(" ")).forEach((a) => {
      if (!this.events[a])
        throw new Error(`The event ${a} does not exist`);
      this.events[a].push(r);
    }), this;
  }
  trigger(i, r) {
    if (!(i in this.events))
      throw new Error(`The event ${String(i)} cannot be triggered`);
    return this.events[i].reduce((e, a) => a(r) !== !1 && e, !0);
  }
  bind(i) {
    if (this.events[i])
      throw new Error(`The event ${i} is already bound`);
    this.events[i] = [];
  }
  exist(i) {
    return Array.isArray(this.events[i]);
  }
  off(i, r) {
    if (this.events[i]) {
      const e = this.events[i];
      if (!r) this.events[i] = [];
      else {
        const a = e.indexOf(r);
        a !== -1 && e.splice(a, 1);
      }
    }
  }
  offAll() {
    this.events = Object.fromEntries(Object.keys(this.events).map((i) => [i, []]));
  }
}
class Qs {
  constructor(i = {}) {
    this.handlers = {}, this.handlers = {
      beforeSetTime: [],
      afterSetTime: [],
      setTimeByTick: [],
      beforeSetPlayRate: [],
      afterSetPlayRate: [],
      setActiveActionIds: [],
      play: [],
      paused: [],
      ended: [],
      ...i
    };
  }
}
const Js = "playing", ea = "paused";
class ta extends Zs {
  constructor() {
    super(new Qs()), this._playRate = 1, this._currentTime = 0, this._playState = "paused", this._prev = 0, this._effectMap = {}, this._actionMap = {}, this._actionSortIds = [], this._next = 0, this._activeActionIds = [];
  }
  /** 是否正在播放 */
  get isPlaying() {
    return this._playState === "playing";
  }
  /** 是否暂停中 */
  get isPaused() {
    return this._playState === "paused";
  }
  set effects(i) {
    this._effectMap = i;
  }
  set data(i) {
    this.isPlaying && this.pause(), this._dealData(i), this._dealClear(), this._dealEnter(this._currentTime);
  }
  /**
   * 设置播放速率
   * @memberof TimelineEngine
   */
  setPlayRate(i) {
    return i <= 0 ? (console.error("Error: rate cannot be less than 0!"), !1) : this.trigger("beforeSetPlayRate", { rate: i, engine: this }) ? (this._playRate = i, this.trigger("afterSetPlayRate", { rate: i, engine: this }), !0) : !1;
  }
  /**
   * 获取播放速率
   * @memberof TimelineEngine
   */
  getPlayRate() {
    return this._playRate;
  }
  /**
   * 重新渲染当前时间
   * @return {*}
   * @memberof TimelineEngine
   */
  reRender() {
    this.isPlaying || this._tickAction(this._currentTime);
  }
  /**
   * 设置播放时间
   * @param {number} time
   * @param {boolean} [isTick] 是否是tick触发
   * @memberof TimelineEngine
   */
  setTime(i, r) {
    return r || this.trigger("beforeSetTime", { time: i, engine: this }) ? (this._currentTime = i, this._next = 0, this._dealLeave(i), this._dealEnter(i), r ? this.trigger("setTimeByTick", { time: i, engine: this }) : this.trigger("afterSetTime", { time: i, engine: this }), !0) : !1;
  }
  /**
   * 获取当前时间
   * @return {*}  {number}
   * @memberof TimelineEngine
   */
  getTime() {
    return this._currentTime;
  }
  /**
   * 运行: 开始时间为当前time
   * @param param
   * @return {boolean} {boolean}
   */
  play(i) {
    const { toTime: r, autoEnd: e } = i, a = this.getTime();
    return this.isPlaying || r && r <= a ? !1 : (this._playState = Js, this._startOrStop("start"), this.trigger("play", { engine: this }), this._timerId = requestAnimationFrame((c) => {
      this._prev = c, this._tick({ now: c, autoEnd: e, to: r });
    }), !0);
  }
  /**
   * 暂停播放
   * @memberof TimelineEngine
   */
  pause() {
    this.isPlaying && (this._playState = ea, this._startOrStop("stop"), this.trigger("paused", { engine: this })), this._timerId && cancelAnimationFrame(this._timerId);
  }
  /** 播放完成 */
  _end() {
    this.pause(), this.trigger("ended", { engine: this });
  }
  _startOrStop(i) {
    for (let r = 0; r < this._activeActionIds.length; r++) {
      const e = this._activeActionIds[r], a = this._actionMap[e], c = this._effectMap[a?.effectId];
      i === "start" ? c?.source?.start && c.source.start({ action: a, effect: c, engine: this, isPlaying: this.isPlaying, time: this.getTime() }) : i === "stop" && c?.source?.stop && c.source.stop({ action: a, effect: c, engine: this, isPlaying: this.isPlaying, time: this.getTime() });
    }
  }
  /** 每帧执行 */
  _tick(i) {
    if (this.isPaused) return;
    const { now: r, autoEnd: e, to: a } = i;
    let c = this.getTime() + Math.min(1e3, r - this._prev) / 1e3 * this._playRate;
    if (this._prev = r, a && a <= c && (c = a), this.setTime(c, !0), this._tickAction(c), !a && e && this._next >= this._actionSortIds.length && this._activeActionIds.length === 0) {
      this._end();
      return;
    }
    a && a <= c && this._end(), !this.isPaused && (this._timerId = requestAnimationFrame((u) => {
      this._tick({ now: u, autoEnd: e, to: a });
    }));
  }
  /** tick运行actions */
  _tickAction(i) {
    this._dealEnter(i), this._dealLeave(i);
    const r = this._activeActionIds.length;
    for (let e = 0; e < r; e++) {
      const a = this._activeActionIds[e], c = this._actionMap[a], u = this._effectMap[c.effectId];
      u && u.source?.update && u.source.update({ time: i, action: c, isPlaying: this.isPlaying, effect: u, engine: this });
    }
  }
  /** 重置active数据 */
  _dealClear() {
    for (; this._activeActionIds.length; ) {
      const i = this._activeActionIds.shift(), r = this._actionMap[i], e = this._effectMap[r?.effectId];
      e?.source?.leave && e.source.leave({ action: r, effect: e, engine: this, isPlaying: this.isPlaying, time: this.getTime() });
    }
    this._next = 0;
  }
  /** 处理action time enter */
  _dealEnter(i) {
    for (; this._actionSortIds[this._next]; ) {
      const r = this._actionSortIds[this._next], e = this._actionMap[r];
      if (!e.disable) {
        if (e.start > i) break;
        if (e.end > i && !this._activeActionIds.includes(r)) {
          const a = this._effectMap[e.effectId];
          a && a.source?.enter && a.source.enter({ action: e, effect: a, isPlaying: this.isPlaying, time: i, engine: this }), this._activeActionIds.push(r);
        }
      }
      this._next++;
    }
  }
  /** 处理action time leave */
  _dealLeave(i) {
    let r = 0;
    for (; this._activeActionIds[r]; ) {
      const e = this._activeActionIds[r], a = this._actionMap[e];
      if (a.start > i || a.end < i) {
        const c = this._effectMap[a.effectId];
        c && c.source?.leave && c.source.leave({ action: a, effect: c, isPlaying: this.isPlaying, time: i, engine: this }), this._activeActionIds.splice(r, 1);
        continue;
      }
      r++;
    }
  }
  /** 处理数据 */
  _dealData(i) {
    const r = [];
    i.map((u) => {
      r.push(...u.actions);
    });
    const e = r.sort((u, h) => u.start - h.start), a = {}, c = [];
    e.forEach((u) => {
      c.push(u.id), a[u.id] = { ...u };
    }), this._actionMap = a, this._actionSortIds = c;
  }
}
function Ge(s, i) {
  if (!(s instanceof i)) throw new TypeError("Cannot call a class as a function");
}
function Ot(s) {
  "@babel/helpers - typeof";
  return Ot = typeof Symbol == "function" && typeof Symbol.iterator == "symbol" ? function(i) {
    return typeof i;
  } : function(i) {
    return i && typeof Symbol == "function" && i.constructor === Symbol && i !== Symbol.prototype ? "symbol" : typeof i;
  }, Ot(s);
}
function na(s, i) {
  if (Ot(s) != "object" || !s) return s;
  var r = s[Symbol.toPrimitive];
  if (r !== void 0) {
    var e = r.call(s, i);
    if (Ot(e) != "object") return e;
    throw new TypeError("@@toPrimitive must return a primitive value.");
  }
  return (i === "string" ? String : Number)(s);
}
function qi(s) {
  var i = na(s, "string");
  return Ot(i) == "symbol" ? i : i + "";
}
function ni(s, i) {
  for (var r = 0; r < i.length; r++) {
    var e = i[r];
    e.enumerable = e.enumerable || !1, e.configurable = !0, "value" in e && (e.writable = !0), Object.defineProperty(s, qi(e.key), e);
  }
}
function We(s, i, r) {
  return i && ni(s.prototype, i), r && ni(s, r), Object.defineProperty(s, "prototype", {
    writable: !1
  }), s;
}
function ra(s) {
  if (s === void 0) throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
  return s;
}
function Xe(s, i) {
  if (i && (Ot(i) == "object" || typeof i == "function")) return i;
  if (i !== void 0) throw new TypeError("Derived constructors may only return object or undefined");
  return ra(s);
}
function ze(s) {
  return ze = Object.setPrototypeOf ? Object.getPrototypeOf.bind() : function(i) {
    return i.__proto__ || Object.getPrototypeOf(i);
  }, ze(s);
}
function Qn(s, i) {
  return Qn = Object.setPrototypeOf ? Object.setPrototypeOf.bind() : function(r, e) {
    return r.__proto__ = e, r;
  }, Qn(s, i);
}
function Ye(s, i) {
  if (typeof i != "function" && i !== null) throw new TypeError("Super expression must either be null or a function");
  s.prototype = Object.create(i && i.prototype, {
    constructor: {
      value: s,
      writable: !0,
      configurable: !0
    }
  }), Object.defineProperty(s, "prototype", {
    writable: !1
  }), i && Qn(s, i);
}
function O(s, i, r) {
  return (i = qi(i)) in s ? Object.defineProperty(s, i, {
    value: r,
    enumerable: !0,
    configurable: !0,
    writable: !0
  }) : s[i] = r, s;
}
function Vi() {
  var s = this.constructor.getDerivedStateFromProps(this.props, this.state);
  s != null && this.setState(s);
}
function Xi(s) {
  function i(r) {
    var e = this.constructor.getDerivedStateFromProps(s, r);
    return e ?? null;
  }
  this.setState(i.bind(this));
}
function Yi(s, i) {
  try {
    var r = this.props, e = this.state;
    this.props = s, this.state = i, this.__reactInternalSnapshotFlag = !0, this.__reactInternalSnapshot = this.getSnapshotBeforeUpdate(
      r,
      e
    );
  } finally {
    this.props = r, this.state = e;
  }
}
Vi.__suppressDeprecationWarning = !0;
Xi.__suppressDeprecationWarning = !0;
Yi.__suppressDeprecationWarning = !0;
function nn(s) {
  var i = s.prototype;
  if (!i || !i.isReactComponent)
    throw new Error("Can only polyfill class components");
  if (typeof s.getDerivedStateFromProps != "function" && typeof i.getSnapshotBeforeUpdate != "function")
    return s;
  var r = null, e = null, a = null;
  if (typeof i.componentWillMount == "function" ? r = "componentWillMount" : typeof i.UNSAFE_componentWillMount == "function" && (r = "UNSAFE_componentWillMount"), typeof i.componentWillReceiveProps == "function" ? e = "componentWillReceiveProps" : typeof i.UNSAFE_componentWillReceiveProps == "function" && (e = "UNSAFE_componentWillReceiveProps"), typeof i.componentWillUpdate == "function" ? a = "componentWillUpdate" : typeof i.UNSAFE_componentWillUpdate == "function" && (a = "UNSAFE_componentWillUpdate"), r !== null || e !== null || a !== null) {
    var c = s.displayName || s.name, u = typeof s.getDerivedStateFromProps == "function" ? "getDerivedStateFromProps()" : "getSnapshotBeforeUpdate()";
    throw Error(
      `Unsafe legacy lifecycles will not be called for components using new component APIs.

` + c + " uses " + u + " but also contains the following legacy lifecycles:" + (r !== null ? `
  ` + r : "") + (e !== null ? `
  ` + e : "") + (a !== null ? `
  ` + a : "") + `

The above lifecycles should be removed. Learn more about this warning here:
https://fb.me/react-async-component-lifecycle-hooks`
    );
  }
  if (typeof s.getDerivedStateFromProps == "function" && (i.componentWillMount = Vi, i.componentWillReceiveProps = Xi), typeof i.getSnapshotBeforeUpdate == "function") {
    if (typeof i.componentDidUpdate != "function")
      throw new Error(
        "Cannot polyfill getSnapshotBeforeUpdate() for components that do not define componentDidUpdate() on the prototype"
      );
    i.componentWillUpdate = Yi;
    var h = i.componentDidUpdate;
    i.componentDidUpdate = function(m, S, b) {
      var C = this.__reactInternalSnapshotFlag ? this.__reactInternalSnapshot : b;
      h.call(this, m, S, C);
    };
  }
  return s;
}
function ri(s, i) {
  var r = Object.keys(s);
  if (Object.getOwnPropertySymbols) {
    var e = Object.getOwnPropertySymbols(s);
    i && (e = e.filter(function(a) {
      return Object.getOwnPropertyDescriptor(s, a).enumerable;
    })), r.push.apply(r, e);
  }
  return r;
}
function ii(s) {
  for (var i = 1; i < arguments.length; i++) {
    var r = arguments[i] != null ? arguments[i] : {};
    i % 2 ? ri(Object(r), !0).forEach(function(e) {
      O(s, e, r[e]);
    }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(s, Object.getOwnPropertyDescriptors(r)) : ri(Object(r)).forEach(function(e) {
      Object.defineProperty(s, e, Object.getOwnPropertyDescriptor(r, e));
    });
  }
  return s;
}
function ia(s, i, r) {
  return i = ze(i), Xe(s, Ki() ? Reflect.construct(i, r || [], ze(s).constructor) : i.apply(s, r));
}
function Ki() {
  try {
    var s = !Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function() {
    }));
  } catch {
  }
  return (Ki = function() {
    return !!s;
  })();
}
var Zi = /* @__PURE__ */ (function(s) {
  function i() {
    var r;
    Ge(this, i);
    for (var e = arguments.length, a = new Array(e), c = 0; c < e; c++)
      a[c] = arguments[c];
    return r = ia(this, i, [].concat(a)), O(r, "state", {
      scrollToColumn: 0,
      scrollToRow: 0,
      instanceProps: {
        prevScrollToColumn: 0,
        prevScrollToRow: 0
      }
    }), O(r, "_columnStartIndex", 0), O(r, "_columnStopIndex", 0), O(r, "_rowStartIndex", 0), O(r, "_rowStopIndex", 0), O(r, "_onKeyDown", function(u) {
      var h = r.props, v = h.columnCount, m = h.disabled, S = h.mode, b = h.rowCount;
      if (!m) {
        var C = r._getScrollState(), R = C.scrollToColumn, z = C.scrollToRow, E = r._getScrollState(), k = E.scrollToColumn, L = E.scrollToRow;
        switch (u.key) {
          case "ArrowDown":
            L = Math.min(S === "cells" ? L + 1 : r._rowStopIndex + 1, b - 1);
            break;
          case "ArrowLeft":
            k = Math.max(S === "cells" ? k - 1 : r._columnStartIndex - 1, 0);
            break;
          case "ArrowRight":
            k = Math.min(S === "cells" ? k + 1 : r._columnStopIndex + 1, v - 1);
            break;
          case "ArrowUp":
            L = Math.max(S === "cells" ? L - 1 : r._rowStartIndex - 1, 0);
            break;
        }
        (k !== R || L !== z) && (u.preventDefault(), r._updateScrollState({
          scrollToColumn: k,
          scrollToRow: L
        }));
      }
    }), O(r, "_onSectionRendered", function(u) {
      var h = u.columnStartIndex, v = u.columnStopIndex, m = u.rowStartIndex, S = u.rowStopIndex;
      r._columnStartIndex = h, r._columnStopIndex = v, r._rowStartIndex = m, r._rowStopIndex = S;
    }), r;
  }
  return Ye(i, s), We(i, [{
    key: "setScrollIndexes",
    value: function(e) {
      var a = e.scrollToColumn, c = e.scrollToRow;
      this.setState({
        scrollToRow: c,
        scrollToColumn: a
      });
    }
  }, {
    key: "render",
    value: function() {
      var e = this.props, a = e.className, c = e.children, u = this._getScrollState(), h = u.scrollToColumn, v = u.scrollToRow;
      return /* @__PURE__ */ le.createElement("div", {
        className: a,
        onKeyDown: this._onKeyDown
      }, c({
        onSectionRendered: this._onSectionRendered,
        scrollToColumn: h,
        scrollToRow: v
      }));
    }
  }, {
    key: "_getScrollState",
    value: function() {
      return this.props.isControlled ? this.props : this.state;
    }
  }, {
    key: "_updateScrollState",
    value: function(e) {
      var a = e.scrollToColumn, c = e.scrollToRow, u = this.props, h = u.isControlled, v = u.onScrollToChange;
      typeof v == "function" && v({
        scrollToColumn: a,
        scrollToRow: c
      }), h || this.setState({
        scrollToColumn: a,
        scrollToRow: c
      });
    }
  }], [{
    key: "getDerivedStateFromProps",
    value: function(e, a) {
      return e.isControlled ? {} : e.scrollToColumn !== a.instanceProps.prevScrollToColumn || e.scrollToRow !== a.instanceProps.prevScrollToRow ? ii(ii({}, a), {}, {
        scrollToColumn: e.scrollToColumn,
        scrollToRow: e.scrollToRow,
        instanceProps: {
          prevScrollToColumn: e.scrollToColumn,
          prevScrollToRow: e.scrollToRow
        }
      }) : {};
    }
  }]);
})(le.PureComponent);
O(Zi, "defaultProps", {
  disabled: !1,
  isControlled: !1,
  mode: "edges",
  scrollToColumn: 0,
  scrollToRow: 0
});
nn(Zi);
function Qi(s, i) {
  var r;
  typeof i < "u" ? r = i : typeof window < "u" ? r = window : typeof self < "u" ? r = self : r = global;
  var e = typeof r.document < "u" && r.document.attachEvent;
  if (!e) {
    var a = (function() {
      var x = r.requestAnimationFrame || r.mozRequestAnimationFrame || r.webkitRequestAnimationFrame || function(j) {
        return r.setTimeout(j, 20);
      };
      return function(j) {
        return x(j);
      };
    })(), c = (function() {
      var x = r.cancelAnimationFrame || r.mozCancelAnimationFrame || r.webkitCancelAnimationFrame || r.clearTimeout;
      return function(j) {
        return x(j);
      };
    })(), u = function(j) {
      var ie = j.__resizeTriggers__, te = ie.firstElementChild, Q = ie.lastElementChild, ce = te.firstElementChild;
      Q.scrollLeft = Q.scrollWidth, Q.scrollTop = Q.scrollHeight, ce.style.width = te.offsetWidth + 1 + "px", ce.style.height = te.offsetHeight + 1 + "px", te.scrollLeft = te.scrollWidth, te.scrollTop = te.scrollHeight;
    }, h = function(j) {
      return j.offsetWidth != j.__resizeLast__.width || j.offsetHeight != j.__resizeLast__.height;
    }, v = function(j) {
      if (!(j.target.className && typeof j.target.className.indexOf == "function" && j.target.className.indexOf("contract-trigger") < 0 && j.target.className.indexOf("expand-trigger") < 0)) {
        var ie = this;
        u(this), this.__resizeRAF__ && c(this.__resizeRAF__), this.__resizeRAF__ = a(function() {
          h(ie) && (ie.__resizeLast__.width = ie.offsetWidth, ie.__resizeLast__.height = ie.offsetHeight, ie.__resizeListeners__.forEach(function(te) {
            te.call(ie, j);
          }));
        });
      }
    }, m = !1, S = "", b = "animationstart", C = "Webkit Moz O ms".split(" "), R = "webkitAnimationStart animationstart oAnimationStart MSAnimationStart".split(" "), z = "";
    {
      var E = r.document.createElement("fakeelement");
      if (E.style.animationName !== void 0 && (m = !0), m === !1) {
        for (var k = 0; k < C.length; k++)
          if (E.style[C[k] + "AnimationName"] !== void 0) {
            z = C[k], S = "-" + z.toLowerCase() + "-", b = R[k], m = !0;
            break;
          }
      }
    }
    var L = "resizeanim", q = "@" + S + "keyframes " + L + " { from { opacity: 0; } to { opacity: 0; } } ", P = S + "animation: 1ms " + L + "; ";
  }
  var W = function(j) {
    if (!j.getElementById("detectElementResize")) {
      var ie = (q || "") + ".resize-triggers { " + (P || "") + 'visibility: hidden; opacity: 0; } .resize-triggers, .resize-triggers > div, .contract-trigger:before { content: " "; display: block; position: absolute; top: 0; left: 0; height: 100%; width: 100%; overflow: hidden; z-index: -1; } .resize-triggers > div { background: #eee; overflow: auto; } .contract-trigger:before { width: 200%; height: 200%; }', te = j.head || j.getElementsByTagName("head")[0], Q = j.createElement("style");
      Q.id = "detectElementResize", Q.type = "text/css", s != null && Q.setAttribute("nonce", s), Q.styleSheet ? Q.styleSheet.cssText = ie : Q.appendChild(j.createTextNode(ie)), te.appendChild(Q);
    }
  }, I = function(j, ie) {
    if (e)
      j.attachEvent("onresize", ie);
    else {
      if (!j.__resizeTriggers__) {
        var te = j.ownerDocument, Q = r.getComputedStyle(j);
        Q && Q.position == "static" && (j.style.position = "relative"), W(te), j.__resizeLast__ = {}, j.__resizeListeners__ = [], (j.__resizeTriggers__ = te.createElement("div")).className = "resize-triggers";
        var ce = te.createElement("div");
        ce.className = "expand-trigger", ce.appendChild(te.createElement("div"));
        var de = te.createElement("div");
        de.className = "contract-trigger", j.__resizeTriggers__.appendChild(ce), j.__resizeTriggers__.appendChild(de), j.appendChild(j.__resizeTriggers__), u(j), j.addEventListener("scroll", v, !0), b && (j.__resizeTriggers__.__animationListener__ = function(pe) {
          pe.animationName == L && u(j);
        }, j.__resizeTriggers__.addEventListener(b, j.__resizeTriggers__.__animationListener__));
      }
      j.__resizeListeners__.push(ie);
    }
  }, V = function(j, ie) {
    if (e)
      j.detachEvent("onresize", ie);
    else if (j.__resizeListeners__.splice(j.__resizeListeners__.indexOf(ie), 1), !j.__resizeListeners__.length) {
      j.removeEventListener("scroll", v, !0), j.__resizeTriggers__.__animationListener__ && (j.__resizeTriggers__.removeEventListener(b, j.__resizeTriggers__.__animationListener__), j.__resizeTriggers__.__animationListener__ = null);
      try {
        j.__resizeTriggers__ = !j.removeChild(j.__resizeTriggers__);
      } catch {
      }
    }
  };
  return {
    addResizeListener: I,
    removeResizeListener: V
  };
}
function oi(s, i) {
  var r = Object.keys(s);
  if (Object.getOwnPropertySymbols) {
    var e = Object.getOwnPropertySymbols(s);
    i && (e = e.filter(function(a) {
      return Object.getOwnPropertyDescriptor(s, a).enumerable;
    })), r.push.apply(r, e);
  }
  return r;
}
function si(s) {
  for (var i = 1; i < arguments.length; i++) {
    var r = arguments[i] != null ? arguments[i] : {};
    i % 2 ? oi(Object(r), !0).forEach(function(e) {
      O(s, e, r[e]);
    }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(s, Object.getOwnPropertyDescriptors(r)) : oi(Object(r)).forEach(function(e) {
      Object.defineProperty(s, e, Object.getOwnPropertyDescriptor(r, e));
    });
  }
  return s;
}
function oa(s, i, r) {
  return i = ze(i), Xe(s, Ji() ? Reflect.construct(i, r || [], ze(s).constructor) : i.apply(s, r));
}
function Ji() {
  try {
    var s = !Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function() {
    }));
  } catch {
  }
  return (Ji = function() {
    return !!s;
  })();
}
var cr = /* @__PURE__ */ (function(s) {
  function i() {
    var r;
    Ge(this, i);
    for (var e = arguments.length, a = new Array(e), c = 0; c < e; c++)
      a[c] = arguments[c];
    return r = oa(this, i, [].concat(a)), O(r, "state", {
      height: r.props.defaultHeight || 0,
      width: r.props.defaultWidth || 0
    }), O(r, "_parentNode", void 0), O(r, "_autoSizer", void 0), O(r, "_window", void 0), O(r, "_detectElementResize", void 0), O(r, "_onResize", function() {
      var u = r.props, h = u.disableHeight, v = u.disableWidth, m = u.onResize;
      if (r._parentNode) {
        var S = r._parentNode.offsetHeight || 0, b = r._parentNode.offsetWidth || 0, C = r._window || window, R = C.getComputedStyle(r._parentNode) || {}, z = parseInt(R.paddingLeft, 10) || 0, E = parseInt(R.paddingRight, 10) || 0, k = parseInt(R.paddingTop, 10) || 0, L = parseInt(R.paddingBottom, 10) || 0, q = S - k - L, P = b - z - E;
        (!h && r.state.height !== q || !v && r.state.width !== P) && (r.setState({
          height: S - k - L,
          width: b - z - E
        }), m({
          height: S,
          width: b
        }));
      }
    }), O(r, "_setRef", function(u) {
      r._autoSizer = u;
    }), r;
  }
  return Ye(i, s), We(i, [{
    key: "componentDidMount",
    value: function() {
      var e = this.props.nonce;
      this._autoSizer && this._autoSizer.parentNode && this._autoSizer.parentNode.ownerDocument && this._autoSizer.parentNode.ownerDocument.defaultView && this._autoSizer.parentNode instanceof this._autoSizer.parentNode.ownerDocument.defaultView.HTMLElement && (this._parentNode = this._autoSizer.parentNode, this._window = this._autoSizer.parentNode.ownerDocument.defaultView, this._detectElementResize = Qi(e, this._window), this._detectElementResize.addResizeListener(this._parentNode, this._onResize), this._onResize());
    }
  }, {
    key: "componentWillUnmount",
    value: function() {
      this._detectElementResize && this._parentNode && this._detectElementResize.removeResizeListener(this._parentNode, this._onResize);
    }
  }, {
    key: "render",
    value: function() {
      var e = this.props, a = e.children, c = e.className, u = e.disableHeight, h = e.disableWidth, v = e.style, m = this.state, S = m.height, b = m.width, C = {
        overflow: "visible"
      }, R = {};
      return u || (C.height = 0, R.height = S), h || (C.width = 0, R.width = b), /* @__PURE__ */ le.createElement("div", {
        className: c,
        ref: this._setRef,
        style: si(si({}, C), v)
      }, a(R));
    }
  }]);
})(le.Component);
O(cr, "defaultProps", {
  onResize: function() {
  },
  disableHeight: !1,
  disableWidth: !1,
  style: {}
});
function sa(s, i, r) {
  return i = ze(i), Xe(s, eo() ? Reflect.construct(i, r || [], ze(s).constructor) : i.apply(s, r));
}
function eo() {
  try {
    var s = !Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function() {
    }));
  } catch {
  }
  return (eo = function() {
    return !!s;
  })();
}
var to = /* @__PURE__ */ (function(s) {
  function i() {
    var r;
    Ge(this, i);
    for (var e = arguments.length, a = new Array(e), c = 0; c < e; c++)
      a[c] = arguments[c];
    return r = sa(this, i, [].concat(a)), O(r, "_child", /* @__PURE__ */ le.createRef()), O(r, "_measure", function() {
      var u = r.props, h = u.cache, v = u.columnIndex, m = v === void 0 ? 0 : v, S = u.parent, b = u.rowIndex, C = b === void 0 ? r.props.index || 0 : b, R = r._getCellMeasurements(), z = R.height, E = R.width;
      (z !== h.getHeight(C, m) || E !== h.getWidth(C, m)) && (h.set(C, m, E, z), S && typeof S.recomputeGridSize == "function" && S.recomputeGridSize({
        columnIndex: m,
        rowIndex: C
      }));
    }), O(r, "_registerChild", function(u) {
      u && !(u instanceof Element) && console.warn("CellMeasurer registerChild expects to be passed Element or null"), r._child.current = u, u && r._maybeMeasureCell();
    }), r;
  }
  return Ye(i, s), We(i, [{
    key: "componentDidMount",
    value: function() {
      this._maybeMeasureCell();
    }
  }, {
    key: "componentDidUpdate",
    value: function() {
      this._maybeMeasureCell();
    }
  }, {
    key: "render",
    value: function() {
      var e = this, a = this.props.children, c = typeof a == "function" ? a({
        measure: this._measure,
        registerChild: this._registerChild
      }) : a;
      return c === null ? c : /* @__PURE__ */ Bi(c, {
        ref: function(h) {
          typeof c.ref == "function" ? c.ref(h) : c.ref && (c.ref.current = h), e._child.current = h;
        }
      });
    }
  }, {
    key: "_getCellMeasurements",
    value: function() {
      var e = this.props.cache, a = this._child.current;
      if (a && a.ownerDocument && a.ownerDocument.defaultView && a instanceof a.ownerDocument.defaultView.HTMLElement) {
        var c = a.style.width, u = a.style.height;
        e.hasFixedWidth() || (a.style.width = "auto"), e.hasFixedHeight() || (a.style.height = "auto");
        var h = Math.ceil(a.offsetHeight), v = Math.ceil(a.offsetWidth);
        return c && (a.style.width = c), u && (a.style.height = u), {
          height: h,
          width: v
        };
      } else
        return {
          height: 0,
          width: 0
        };
    }
  }, {
    key: "_maybeMeasureCell",
    value: function() {
      var e = this.props, a = e.cache, c = e.columnIndex, u = c === void 0 ? 0 : c, h = e.parent, v = e.rowIndex, m = v === void 0 ? this.props.index || 0 : v;
      if (!a.has(m, u)) {
        var S = this._getCellMeasurements(), b = S.height, C = S.width;
        a.set(m, u, C, b), h && typeof h.invalidateCellSizeAfterRender == "function" && h.invalidateCellSizeAfterRender({
          columnIndex: u,
          rowIndex: m
        });
      }
    }
  }]);
})(le.PureComponent);
O(to, "__internalCellMeasurerFlag", !1);
process.env.NODE_ENV !== "production" && (to.__internalCellMeasurerFlag = !0);
function aa(s) {
  if (s == null) throw new TypeError("Cannot destructure " + s);
}
function tt() {
  return tt = Object.assign ? Object.assign.bind() : function(s) {
    for (var i = 1; i < arguments.length; i++) {
      var r = arguments[i];
      for (var e in r) ({}).hasOwnProperty.call(r, e) && (s[e] = r[e]);
    }
    return s;
  }, tt.apply(null, arguments);
}
function no(s) {
  return s && s.__esModule && Object.prototype.hasOwnProperty.call(s, "default") ? s.default : s;
}
var vn = { exports: {} }, gn = { exports: {} }, Oe = {};
/** @license React v16.13.1
 * react-is.production.min.js
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var ai;
function la() {
  if (ai) return Oe;
  ai = 1;
  var s = typeof Symbol == "function" && Symbol.for, i = s ? Symbol.for("react.element") : 60103, r = s ? Symbol.for("react.portal") : 60106, e = s ? Symbol.for("react.fragment") : 60107, a = s ? Symbol.for("react.strict_mode") : 60108, c = s ? Symbol.for("react.profiler") : 60114, u = s ? Symbol.for("react.provider") : 60109, h = s ? Symbol.for("react.context") : 60110, v = s ? Symbol.for("react.async_mode") : 60111, m = s ? Symbol.for("react.concurrent_mode") : 60111, S = s ? Symbol.for("react.forward_ref") : 60112, b = s ? Symbol.for("react.suspense") : 60113, C = s ? Symbol.for("react.suspense_list") : 60120, R = s ? Symbol.for("react.memo") : 60115, z = s ? Symbol.for("react.lazy") : 60116, E = s ? Symbol.for("react.block") : 60121, k = s ? Symbol.for("react.fundamental") : 60117, L = s ? Symbol.for("react.responder") : 60118, q = s ? Symbol.for("react.scope") : 60119;
  function P(I) {
    if (typeof I == "object" && I !== null) {
      var V = I.$$typeof;
      switch (V) {
        case i:
          switch (I = I.type, I) {
            case v:
            case m:
            case e:
            case c:
            case a:
            case b:
              return I;
            default:
              switch (I = I && I.$$typeof, I) {
                case h:
                case S:
                case z:
                case R:
                case u:
                  return I;
                default:
                  return V;
              }
          }
        case r:
          return V;
      }
    }
  }
  function W(I) {
    return P(I) === m;
  }
  return Oe.AsyncMode = v, Oe.ConcurrentMode = m, Oe.ContextConsumer = h, Oe.ContextProvider = u, Oe.Element = i, Oe.ForwardRef = S, Oe.Fragment = e, Oe.Lazy = z, Oe.Memo = R, Oe.Portal = r, Oe.Profiler = c, Oe.StrictMode = a, Oe.Suspense = b, Oe.isAsyncMode = function(I) {
    return W(I) || P(I) === v;
  }, Oe.isConcurrentMode = W, Oe.isContextConsumer = function(I) {
    return P(I) === h;
  }, Oe.isContextProvider = function(I) {
    return P(I) === u;
  }, Oe.isElement = function(I) {
    return typeof I == "object" && I !== null && I.$$typeof === i;
  }, Oe.isForwardRef = function(I) {
    return P(I) === S;
  }, Oe.isFragment = function(I) {
    return P(I) === e;
  }, Oe.isLazy = function(I) {
    return P(I) === z;
  }, Oe.isMemo = function(I) {
    return P(I) === R;
  }, Oe.isPortal = function(I) {
    return P(I) === r;
  }, Oe.isProfiler = function(I) {
    return P(I) === c;
  }, Oe.isStrictMode = function(I) {
    return P(I) === a;
  }, Oe.isSuspense = function(I) {
    return P(I) === b;
  }, Oe.isValidElementType = function(I) {
    return typeof I == "string" || typeof I == "function" || I === e || I === m || I === c || I === a || I === b || I === C || typeof I == "object" && I !== null && (I.$$typeof === z || I.$$typeof === R || I.$$typeof === u || I.$$typeof === h || I.$$typeof === S || I.$$typeof === k || I.$$typeof === L || I.$$typeof === q || I.$$typeof === E);
  }, Oe.typeOf = P, Oe;
}
var Pe = {};
/** @license React v16.13.1
 * react-is.development.js
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var li;
function ca() {
  return li || (li = 1, process.env.NODE_ENV !== "production" && (function() {
    var s = typeof Symbol == "function" && Symbol.for, i = s ? Symbol.for("react.element") : 60103, r = s ? Symbol.for("react.portal") : 60106, e = s ? Symbol.for("react.fragment") : 60107, a = s ? Symbol.for("react.strict_mode") : 60108, c = s ? Symbol.for("react.profiler") : 60114, u = s ? Symbol.for("react.provider") : 60109, h = s ? Symbol.for("react.context") : 60110, v = s ? Symbol.for("react.async_mode") : 60111, m = s ? Symbol.for("react.concurrent_mode") : 60111, S = s ? Symbol.for("react.forward_ref") : 60112, b = s ? Symbol.for("react.suspense") : 60113, C = s ? Symbol.for("react.suspense_list") : 60120, R = s ? Symbol.for("react.memo") : 60115, z = s ? Symbol.for("react.lazy") : 60116, E = s ? Symbol.for("react.block") : 60121, k = s ? Symbol.for("react.fundamental") : 60117, L = s ? Symbol.for("react.responder") : 60118, q = s ? Symbol.for("react.scope") : 60119;
    function P(H) {
      return typeof H == "string" || typeof H == "function" || // Note: its typeof might be other than 'symbol' or 'number' if it's a polyfill.
      H === e || H === m || H === c || H === a || H === b || H === C || typeof H == "object" && H !== null && (H.$$typeof === z || H.$$typeof === R || H.$$typeof === u || H.$$typeof === h || H.$$typeof === S || H.$$typeof === k || H.$$typeof === L || H.$$typeof === q || H.$$typeof === E);
    }
    function W(H) {
      if (typeof H == "object" && H !== null) {
        var J = H.$$typeof;
        switch (J) {
          case i:
            var re = H.type;
            switch (re) {
              case v:
              case m:
              case e:
              case c:
              case a:
              case b:
                return re;
              default:
                var ue = re && re.$$typeof;
                switch (ue) {
                  case h:
                  case S:
                  case z:
                  case R:
                  case u:
                    return ue;
                  default:
                    return J;
                }
            }
          case r:
            return J;
        }
      }
    }
    var I = v, V = m, x = h, j = u, ie = i, te = S, Q = e, ce = z, de = R, he = r, pe = c, Se = a, Te = b, Fe = !1;
    function Re(H) {
      return Fe || (Fe = !0, console.warn("The ReactIs.isAsyncMode() alias has been deprecated, and will be removed in React 17+. Update your code to use ReactIs.isConcurrentMode() instead. It has the exact same API.")), G(H) || W(H) === v;
    }
    function G(H) {
      return W(H) === m;
    }
    function F(H) {
      return W(H) === h;
    }
    function oe(H) {
      return W(H) === u;
    }
    function U(H) {
      return typeof H == "object" && H !== null && H.$$typeof === i;
    }
    function X(H) {
      return W(H) === S;
    }
    function Y(H) {
      return W(H) === e;
    }
    function Z(H) {
      return W(H) === z;
    }
    function ne(H) {
      return W(H) === R;
    }
    function fe(H) {
      return W(H) === r;
    }
    function A(H) {
      return W(H) === c;
    }
    function se(H) {
      return W(H) === a;
    }
    function Ce(H) {
      return W(H) === b;
    }
    Pe.AsyncMode = I, Pe.ConcurrentMode = V, Pe.ContextConsumer = x, Pe.ContextProvider = j, Pe.Element = ie, Pe.ForwardRef = te, Pe.Fragment = Q, Pe.Lazy = ce, Pe.Memo = de, Pe.Portal = he, Pe.Profiler = pe, Pe.StrictMode = Se, Pe.Suspense = Te, Pe.isAsyncMode = Re, Pe.isConcurrentMode = G, Pe.isContextConsumer = F, Pe.isContextProvider = oe, Pe.isElement = U, Pe.isForwardRef = X, Pe.isFragment = Y, Pe.isLazy = Z, Pe.isMemo = ne, Pe.isPortal = fe, Pe.isProfiler = A, Pe.isStrictMode = se, Pe.isSuspense = Ce, Pe.isValidElementType = P, Pe.typeOf = W;
  })()), Pe;
}
var ci;
function ro() {
  return ci || (ci = 1, process.env.NODE_ENV === "production" ? gn.exports = la() : gn.exports = ca()), gn.exports;
}
/*
object-assign
(c) Sindre Sorhus
@license MIT
*/
var Hn, ui;
function ua() {
  if (ui) return Hn;
  ui = 1;
  var s = Object.getOwnPropertySymbols, i = Object.prototype.hasOwnProperty, r = Object.prototype.propertyIsEnumerable;
  function e(c) {
    if (c == null)
      throw new TypeError("Object.assign cannot be called with null or undefined");
    return Object(c);
  }
  function a() {
    try {
      if (!Object.assign)
        return !1;
      var c = new String("abc");
      if (c[5] = "de", Object.getOwnPropertyNames(c)[0] === "5")
        return !1;
      for (var u = {}, h = 0; h < 10; h++)
        u["_" + String.fromCharCode(h)] = h;
      var v = Object.getOwnPropertyNames(u).map(function(S) {
        return u[S];
      });
      if (v.join("") !== "0123456789")
        return !1;
      var m = {};
      return "abcdefghijklmnopqrst".split("").forEach(function(S) {
        m[S] = S;
      }), Object.keys(Object.assign({}, m)).join("") === "abcdefghijklmnopqrst";
    } catch {
      return !1;
    }
  }
  return Hn = a() ? Object.assign : function(c, u) {
    for (var h, v = e(c), m, S = 1; S < arguments.length; S++) {
      h = Object(arguments[S]);
      for (var b in h)
        i.call(h, b) && (v[b] = h[b]);
      if (s) {
        m = s(h);
        for (var C = 0; C < m.length; C++)
          r.call(h, m[C]) && (v[m[C]] = h[m[C]]);
      }
    }
    return v;
  }, Hn;
}
var $n, di;
function ur() {
  if (di) return $n;
  di = 1;
  var s = "SECRET_DO_NOT_PASS_THIS_OR_YOU_WILL_BE_FIRED";
  return $n = s, $n;
}
var Un, fi;
function io() {
  return fi || (fi = 1, Un = Function.call.bind(Object.prototype.hasOwnProperty)), Un;
}
var Bn, hi;
function da() {
  if (hi) return Bn;
  hi = 1;
  var s = function() {
  };
  if (process.env.NODE_ENV !== "production") {
    var i = /* @__PURE__ */ ur(), r = {}, e = /* @__PURE__ */ io();
    s = function(c) {
      var u = "Warning: " + c;
      typeof console < "u" && console.error(u);
      try {
        throw new Error(u);
      } catch {
      }
    };
  }
  function a(c, u, h, v, m) {
    if (process.env.NODE_ENV !== "production") {
      for (var S in c)
        if (e(c, S)) {
          var b;
          try {
            if (typeof c[S] != "function") {
              var C = Error(
                (v || "React class") + ": " + h + " type `" + S + "` is invalid; it must be a function, usually from the `prop-types` package, but received `" + typeof c[S] + "`.This often happens because of typos such as `PropTypes.function` instead of `PropTypes.func`."
              );
              throw C.name = "Invariant Violation", C;
            }
            b = c[S](u, S, v, h, null, i);
          } catch (z) {
            b = z;
          }
          if (b && !(b instanceof Error) && s(
            (v || "React class") + ": type specification of " + h + " `" + S + "` is invalid; the type checker function must return `null` or an `Error` but returned a " + typeof b + ". You may have forgotten to pass an argument to the type checker creator (arrayOf, instanceOf, objectOf, oneOf, oneOfType, and shape all require an argument)."
          ), b instanceof Error && !(b.message in r)) {
            r[b.message] = !0;
            var R = m ? m() : "";
            s(
              "Failed " + h + " type: " + b.message + (R ?? "")
            );
          }
        }
    }
  }
  return a.resetWarningCache = function() {
    process.env.NODE_ENV !== "production" && (r = {});
  }, Bn = a, Bn;
}
var qn, pi;
function fa() {
  if (pi) return qn;
  pi = 1;
  var s = ro(), i = ua(), r = /* @__PURE__ */ ur(), e = /* @__PURE__ */ io(), a = /* @__PURE__ */ da(), c = function() {
  };
  process.env.NODE_ENV !== "production" && (c = function(h) {
    var v = "Warning: " + h;
    typeof console < "u" && console.error(v);
    try {
      throw new Error(v);
    } catch {
    }
  });
  function u() {
    return null;
  }
  return qn = function(h, v) {
    var m = typeof Symbol == "function" && Symbol.iterator, S = "@@iterator";
    function b(G) {
      var F = G && (m && G[m] || G[S]);
      if (typeof F == "function")
        return F;
    }
    var C = "<<anonymous>>", R = {
      array: L("array"),
      bigint: L("bigint"),
      bool: L("boolean"),
      func: L("function"),
      number: L("number"),
      object: L("object"),
      string: L("string"),
      symbol: L("symbol"),
      any: q(),
      arrayOf: P,
      element: W(),
      elementType: I(),
      instanceOf: V,
      node: te(),
      objectOf: j,
      oneOf: x,
      oneOfType: ie,
      shape: ce,
      exact: de
    };
    function z(G, F) {
      return G === F ? G !== 0 || 1 / G === 1 / F : G !== G && F !== F;
    }
    function E(G, F) {
      this.message = G, this.data = F && typeof F == "object" ? F : {}, this.stack = "";
    }
    E.prototype = Error.prototype;
    function k(G) {
      if (process.env.NODE_ENV !== "production")
        var F = {}, oe = 0;
      function U(Y, Z, ne, fe, A, se, Ce) {
        if (fe = fe || C, se = se || ne, Ce !== r) {
          if (v) {
            var H = new Error(
              "Calling PropTypes validators directly is not supported by the `prop-types` package. Use `PropTypes.checkPropTypes()` to call them. Read more at http://fb.me/use-check-prop-types"
            );
            throw H.name = "Invariant Violation", H;
          } else if (process.env.NODE_ENV !== "production" && typeof console < "u") {
            var J = fe + ":" + ne;
            !F[J] && // Avoid spamming the console because they are often not actionable except for lib authors
            oe < 3 && (c(
              "You are manually calling a React.PropTypes validation function for the `" + se + "` prop on `" + fe + "`. This is deprecated and will throw in the standalone `prop-types` package. You may be seeing this warning due to a third-party PropTypes library. See https://fb.me/react-warning-dont-call-proptypes for details."
            ), F[J] = !0, oe++);
          }
        }
        return Z[ne] == null ? Y ? Z[ne] === null ? new E("The " + A + " `" + se + "` is marked as required " + ("in `" + fe + "`, but its value is `null`.")) : new E("The " + A + " `" + se + "` is marked as required in " + ("`" + fe + "`, but its value is `undefined`.")) : null : G(Z, ne, fe, A, se);
      }
      var X = U.bind(null, !1);
      return X.isRequired = U.bind(null, !0), X;
    }
    function L(G) {
      function F(oe, U, X, Y, Z, ne) {
        var fe = oe[U], A = Se(fe);
        if (A !== G) {
          var se = Te(fe);
          return new E(
            "Invalid " + Y + " `" + Z + "` of type " + ("`" + se + "` supplied to `" + X + "`, expected ") + ("`" + G + "`."),
            { expectedType: G }
          );
        }
        return null;
      }
      return k(F);
    }
    function q() {
      return k(u);
    }
    function P(G) {
      function F(oe, U, X, Y, Z) {
        if (typeof G != "function")
          return new E("Property `" + Z + "` of component `" + X + "` has invalid PropType notation inside arrayOf.");
        var ne = oe[U];
        if (!Array.isArray(ne)) {
          var fe = Se(ne);
          return new E("Invalid " + Y + " `" + Z + "` of type " + ("`" + fe + "` supplied to `" + X + "`, expected an array."));
        }
        for (var A = 0; A < ne.length; A++) {
          var se = G(ne, A, X, Y, Z + "[" + A + "]", r);
          if (se instanceof Error)
            return se;
        }
        return null;
      }
      return k(F);
    }
    function W() {
      function G(F, oe, U, X, Y) {
        var Z = F[oe];
        if (!h(Z)) {
          var ne = Se(Z);
          return new E("Invalid " + X + " `" + Y + "` of type " + ("`" + ne + "` supplied to `" + U + "`, expected a single ReactElement."));
        }
        return null;
      }
      return k(G);
    }
    function I() {
      function G(F, oe, U, X, Y) {
        var Z = F[oe];
        if (!s.isValidElementType(Z)) {
          var ne = Se(Z);
          return new E("Invalid " + X + " `" + Y + "` of type " + ("`" + ne + "` supplied to `" + U + "`, expected a single ReactElement type."));
        }
        return null;
      }
      return k(G);
    }
    function V(G) {
      function F(oe, U, X, Y, Z) {
        if (!(oe[U] instanceof G)) {
          var ne = G.name || C, fe = Re(oe[U]);
          return new E("Invalid " + Y + " `" + Z + "` of type " + ("`" + fe + "` supplied to `" + X + "`, expected ") + ("instance of `" + ne + "`."));
        }
        return null;
      }
      return k(F);
    }
    function x(G) {
      if (!Array.isArray(G))
        return process.env.NODE_ENV !== "production" && (arguments.length > 1 ? c(
          "Invalid arguments supplied to oneOf, expected an array, got " + arguments.length + " arguments. A common mistake is to write oneOf(x, y, z) instead of oneOf([x, y, z])."
        ) : c("Invalid argument supplied to oneOf, expected an array.")), u;
      function F(oe, U, X, Y, Z) {
        for (var ne = oe[U], fe = 0; fe < G.length; fe++)
          if (z(ne, G[fe]))
            return null;
        var A = JSON.stringify(G, function(Ce, H) {
          var J = Te(H);
          return J === "symbol" ? String(H) : H;
        });
        return new E("Invalid " + Y + " `" + Z + "` of value `" + String(ne) + "` " + ("supplied to `" + X + "`, expected one of " + A + "."));
      }
      return k(F);
    }
    function j(G) {
      function F(oe, U, X, Y, Z) {
        if (typeof G != "function")
          return new E("Property `" + Z + "` of component `" + X + "` has invalid PropType notation inside objectOf.");
        var ne = oe[U], fe = Se(ne);
        if (fe !== "object")
          return new E("Invalid " + Y + " `" + Z + "` of type " + ("`" + fe + "` supplied to `" + X + "`, expected an object."));
        for (var A in ne)
          if (e(ne, A)) {
            var se = G(ne, A, X, Y, Z + "." + A, r);
            if (se instanceof Error)
              return se;
          }
        return null;
      }
      return k(F);
    }
    function ie(G) {
      if (!Array.isArray(G))
        return process.env.NODE_ENV !== "production" && c("Invalid argument supplied to oneOfType, expected an instance of array."), u;
      for (var F = 0; F < G.length; F++) {
        var oe = G[F];
        if (typeof oe != "function")
          return c(
            "Invalid argument supplied to oneOfType. Expected an array of check functions, but received " + Fe(oe) + " at index " + F + "."
          ), u;
      }
      function U(X, Y, Z, ne, fe) {
        for (var A = [], se = 0; se < G.length; se++) {
          var Ce = G[se], H = Ce(X, Y, Z, ne, fe, r);
          if (H == null)
            return null;
          H.data && e(H.data, "expectedType") && A.push(H.data.expectedType);
        }
        var J = A.length > 0 ? ", expected one of type [" + A.join(", ") + "]" : "";
        return new E("Invalid " + ne + " `" + fe + "` supplied to " + ("`" + Z + "`" + J + "."));
      }
      return k(U);
    }
    function te() {
      function G(F, oe, U, X, Y) {
        return he(F[oe]) ? null : new E("Invalid " + X + " `" + Y + "` supplied to " + ("`" + U + "`, expected a ReactNode."));
      }
      return k(G);
    }
    function Q(G, F, oe, U, X) {
      return new E(
        (G || "React class") + ": " + F + " type `" + oe + "." + U + "` is invalid; it must be a function, usually from the `prop-types` package, but received `" + X + "`."
      );
    }
    function ce(G) {
      function F(oe, U, X, Y, Z) {
        var ne = oe[U], fe = Se(ne);
        if (fe !== "object")
          return new E("Invalid " + Y + " `" + Z + "` of type `" + fe + "` " + ("supplied to `" + X + "`, expected `object`."));
        for (var A in G) {
          var se = G[A];
          if (typeof se != "function")
            return Q(X, Y, Z, A, Te(se));
          var Ce = se(ne, A, X, Y, Z + "." + A, r);
          if (Ce)
            return Ce;
        }
        return null;
      }
      return k(F);
    }
    function de(G) {
      function F(oe, U, X, Y, Z) {
        var ne = oe[U], fe = Se(ne);
        if (fe !== "object")
          return new E("Invalid " + Y + " `" + Z + "` of type `" + fe + "` " + ("supplied to `" + X + "`, expected `object`."));
        var A = i({}, oe[U], G);
        for (var se in A) {
          var Ce = G[se];
          if (e(G, se) && typeof Ce != "function")
            return Q(X, Y, Z, se, Te(Ce));
          if (!Ce)
            return new E(
              "Invalid " + Y + " `" + Z + "` key `" + se + "` supplied to `" + X + "`.\nBad object: " + JSON.stringify(oe[U], null, "  ") + `
Valid keys: ` + JSON.stringify(Object.keys(G), null, "  ")
            );
          var H = Ce(ne, se, X, Y, Z + "." + se, r);
          if (H)
            return H;
        }
        return null;
      }
      return k(F);
    }
    function he(G) {
      switch (typeof G) {
        case "number":
        case "string":
        case "undefined":
          return !0;
        case "boolean":
          return !G;
        case "object":
          if (Array.isArray(G))
            return G.every(he);
          if (G === null || h(G))
            return !0;
          var F = b(G);
          if (F) {
            var oe = F.call(G), U;
            if (F !== G.entries) {
              for (; !(U = oe.next()).done; )
                if (!he(U.value))
                  return !1;
            } else
              for (; !(U = oe.next()).done; ) {
                var X = U.value;
                if (X && !he(X[1]))
                  return !1;
              }
          } else
            return !1;
          return !0;
        default:
          return !1;
      }
    }
    function pe(G, F) {
      return G === "symbol" ? !0 : F ? F["@@toStringTag"] === "Symbol" || typeof Symbol == "function" && F instanceof Symbol : !1;
    }
    function Se(G) {
      var F = typeof G;
      return Array.isArray(G) ? "array" : G instanceof RegExp ? "object" : pe(F, G) ? "symbol" : F;
    }
    function Te(G) {
      if (typeof G > "u" || G === null)
        return "" + G;
      var F = Se(G);
      if (F === "object") {
        if (G instanceof Date)
          return "date";
        if (G instanceof RegExp)
          return "regexp";
      }
      return F;
    }
    function Fe(G) {
      var F = Te(G);
      switch (F) {
        case "array":
        case "object":
          return "an " + F;
        case "boolean":
        case "date":
        case "regexp":
          return "a " + F;
        default:
          return F;
      }
    }
    function Re(G) {
      return !G.constructor || !G.constructor.name ? C : G.constructor.name;
    }
    return R.checkPropTypes = a, R.resetWarningCache = a.resetWarningCache, R.PropTypes = R, R;
  }, qn;
}
var Vn, vi;
function ha() {
  if (vi) return Vn;
  vi = 1;
  var s = /* @__PURE__ */ ur();
  function i() {
  }
  function r() {
  }
  return r.resetWarningCache = i, Vn = function() {
    function e(u, h, v, m, S, b) {
      if (b !== s) {
        var C = new Error(
          "Calling PropTypes validators directly is not supported by the `prop-types` package. Use PropTypes.checkPropTypes() to call them. Read more at http://fb.me/use-check-prop-types"
        );
        throw C.name = "Invariant Violation", C;
      }
    }
    e.isRequired = e;
    function a() {
      return e;
    }
    var c = {
      array: e,
      bigint: e,
      bool: e,
      func: e,
      number: e,
      object: e,
      string: e,
      symbol: e,
      any: e,
      arrayOf: a,
      element: e,
      elementType: e,
      instanceOf: a,
      node: e,
      objectOf: a,
      oneOf: a,
      oneOfType: a,
      shape: a,
      exact: a,
      checkPropTypes: r,
      resetWarningCache: i
    };
    return c.PropTypes = c, c;
  }, Vn;
}
var gi;
function pa() {
  if (gi) return vn.exports;
  if (gi = 1, process.env.NODE_ENV !== "production") {
    var s = ro(), i = !0;
    vn.exports = /* @__PURE__ */ fa()(s.isElement, i);
  } else
    vn.exports = /* @__PURE__ */ ha()();
  return vn.exports;
}
var va = /* @__PURE__ */ pa();
const D = /* @__PURE__ */ no(va);
function oo(s) {
  var i, r, e = "";
  if (typeof s == "string" || typeof s == "number") e += s;
  else if (typeof s == "object") if (Array.isArray(s)) for (i = 0; i < s.length; i++) s[i] && (r = oo(s[i])) && (e && (e += " "), e += r);
  else for (i in s) s[i] && (e && (e += " "), e += i);
  return e;
}
function rt() {
  for (var s, i, r = 0, e = ""; r < arguments.length; ) (s = arguments[r++]) && (i = oo(s)) && (e && (e += " "), e += i);
  return e;
}
function Gt() {
  var s = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : !0, i = {};
  return function(r) {
    var e = r.callback, a = r.indices, c = Object.keys(a), u = !s || c.every(function(v) {
      var m = a[v];
      return Array.isArray(m) ? m.length > 0 : m >= 0;
    }), h = c.length !== Object.keys(i).length || c.some(function(v) {
      var m = i[v], S = a[v];
      return Array.isArray(S) ? m.join(",") !== S.join(",") : m !== S;
    });
    i = a, u && h && e(a);
  };
}
const ga = !!(typeof window < "u" && window.document && window.document.createElement);
var mn;
function Jn(s) {
  if ((!mn && mn !== 0 || s) && ga) {
    var i = document.createElement("div");
    i.style.position = "absolute", i.style.top = "-9999px", i.style.width = "50px", i.style.height = "50px", i.style.overflow = "scroll", document.body.appendChild(i), mn = i.offsetWidth - i.clientWidth, document.body.removeChild(i);
  }
  return mn;
}
function mi(s, i) {
  var r = Object.keys(s);
  if (Object.getOwnPropertySymbols) {
    var e = Object.getOwnPropertySymbols(s);
    i && (e = e.filter(function(a) {
      return Object.getOwnPropertyDescriptor(s, a).enumerable;
    })), r.push.apply(r, e);
  }
  return r;
}
function yi(s) {
  for (var i = 1; i < arguments.length; i++) {
    var r = arguments[i] != null ? arguments[i] : {};
    i % 2 ? mi(Object(r), !0).forEach(function(e) {
      O(s, e, r[e]);
    }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(s, Object.getOwnPropertyDescriptors(r)) : mi(Object(r)).forEach(function(e) {
      Object.defineProperty(s, e, Object.getOwnPropertyDescriptor(r, e));
    });
  }
  return s;
}
function ma(s, i, r) {
  return i = ze(i), Xe(s, so() ? Reflect.construct(i, r || [], ze(s).constructor) : i.apply(s, r));
}
function so() {
  try {
    var s = !Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function() {
    }));
  } catch {
  }
  return (so = function() {
    return !!s;
  })();
}
var ya = 150, kt = {
  OBSERVED: "observed",
  REQUESTED: "requested"
}, Cn = /* @__PURE__ */ (function(s) {
  function i() {
    var r;
    Ge(this, i);
    for (var e = arguments.length, a = new Array(e), c = 0; c < e; c++)
      a[c] = arguments[c];
    return r = ma(this, i, [].concat(a)), O(r, "state", {
      isScrolling: !1,
      scrollLeft: 0,
      scrollTop: 0
    }), O(r, "_calculateSizeAndPositionDataOnNextUpdate", !1), O(r, "_onSectionRenderedMemoizer", Gt()), O(r, "_onScrollMemoizer", Gt(!1)), O(r, "_invokeOnSectionRenderedHelper", function() {
      var u = r.props, h = u.cellLayoutManager, v = u.onSectionRendered;
      r._onSectionRenderedMemoizer({
        callback: v,
        indices: {
          indices: h.getLastRenderedIndices()
        }
      });
    }), O(r, "_setScrollingContainerRef", function(u) {
      r._scrollingContainer = u;
    }), O(r, "_updateScrollPositionForScrollToCell", function() {
      var u = r.props, h = u.cellLayoutManager, v = u.height, m = u.scrollToAlignment, S = u.scrollToCell, b = u.width, C = r.state, R = C.scrollLeft, z = C.scrollTop;
      if (S >= 0) {
        var E = h.getScrollPositionForCell({
          align: m,
          cellIndex: S,
          height: v,
          scrollLeft: R,
          scrollTop: z,
          width: b
        });
        (E.scrollLeft !== R || E.scrollTop !== z) && r._setScrollPosition(E);
      }
    }), O(r, "_onScroll", function(u) {
      if (u.target === r._scrollingContainer) {
        r._enablePointerEventsAfterDelay();
        var h = r.props, v = h.cellLayoutManager, m = h.height, S = h.isScrollingChange, b = h.width, C = r._scrollbarSize, R = v.getTotalSize(), z = R.height, E = R.width, k = Math.max(0, Math.min(E - b + C, u.target.scrollLeft)), L = Math.max(0, Math.min(z - m + C, u.target.scrollTop));
        if (r.state.scrollLeft !== k || r.state.scrollTop !== L) {
          var q = u.cancelable ? kt.OBSERVED : kt.REQUESTED;
          r.state.isScrolling || S(!0), r.setState({
            isScrolling: !0,
            scrollLeft: k,
            scrollPositionChangeReason: q,
            scrollTop: L
          });
        }
        r._invokeOnScrollMemoizer({
          scrollLeft: k,
          scrollTop: L,
          totalWidth: E,
          totalHeight: z
        });
      }
    }), r._scrollbarSize = Jn(), r._scrollbarSize === void 0 ? (r._scrollbarSizeMeasured = !1, r._scrollbarSize = 0) : r._scrollbarSizeMeasured = !0, r;
  }
  return Ye(i, s), We(i, [{
    key: "recomputeCellSizesAndPositions",
    value: function() {
      this._calculateSizeAndPositionDataOnNextUpdate = !0, this.forceUpdate();
    }
    /* ---------------------------- Component lifecycle methods ---------------------------- */
    /**
     * @private
     * This method updates scrollLeft/scrollTop in state for the following conditions:
     * 1) Empty content (0 rows or columns)
     * 2) New scroll props overriding the current state
     * 3) Cells-count or cells-size has changed, making previous scroll offsets invalid
     */
  }, {
    key: "componentDidMount",
    value: function() {
      var e = this.props, a = e.cellLayoutManager, c = e.scrollLeft, u = e.scrollToCell, h = e.scrollTop;
      this._scrollbarSizeMeasured || (this._scrollbarSize = Jn(), this._scrollbarSizeMeasured = !0, this.setState({})), u >= 0 ? this._updateScrollPositionForScrollToCell() : (c >= 0 || h >= 0) && this._setScrollPosition({
        scrollLeft: c,
        scrollTop: h
      }), this._invokeOnSectionRenderedHelper();
      var v = a.getTotalSize(), m = v.height, S = v.width;
      this._invokeOnScrollMemoizer({
        scrollLeft: c || 0,
        scrollTop: h || 0,
        totalHeight: m,
        totalWidth: S
      });
    }
  }, {
    key: "componentDidUpdate",
    value: function(e, a) {
      var c = this.props, u = c.height, h = c.scrollToAlignment, v = c.scrollToCell, m = c.width, S = this.state, b = S.scrollLeft, C = S.scrollPositionChangeReason, R = S.scrollTop;
      C === kt.REQUESTED && (b >= 0 && b !== a.scrollLeft && b !== this._scrollingContainer.scrollLeft && (this._scrollingContainer.scrollLeft = b), R >= 0 && R !== a.scrollTop && R !== this._scrollingContainer.scrollTop && (this._scrollingContainer.scrollTop = R)), (u !== e.height || h !== e.scrollToAlignment || v !== e.scrollToCell || m !== e.width) && this._updateScrollPositionForScrollToCell(), this._invokeOnSectionRenderedHelper();
    }
  }, {
    key: "componentWillUnmount",
    value: function() {
      this._disablePointerEventsTimeoutId && clearTimeout(this._disablePointerEventsTimeoutId);
    }
  }, {
    key: "render",
    value: function() {
      var e = this.props, a = e.autoHeight, c = e.cellCount, u = e.cellLayoutManager, h = e.className, v = e.height, m = e.horizontalOverscanSize, S = e.id, b = e.noContentRenderer, C = e.style, R = e.verticalOverscanSize, z = e.width, E = this.state, k = E.isScrolling, L = E.scrollLeft, q = E.scrollTop;
      (this._lastRenderedCellCount !== c || this._lastRenderedCellLayoutManager !== u || this._calculateSizeAndPositionDataOnNextUpdate) && (this._lastRenderedCellCount = c, this._lastRenderedCellLayoutManager = u, this._calculateSizeAndPositionDataOnNextUpdate = !1, u.calculateSizeAndPositionData());
      var P = u.getTotalSize(), W = P.height, I = P.width, V = Math.max(0, L - m), x = Math.max(0, q - R), j = Math.min(I, L + z + m), ie = Math.min(W, q + v + R), te = v > 0 && z > 0 ? u.cellRenderers({
        height: ie - x,
        isScrolling: k,
        width: j - V,
        x: V,
        y: x
      }) : [], Q = {
        boxSizing: "border-box",
        direction: "ltr",
        height: a ? "auto" : v,
        position: "relative",
        WebkitOverflowScrolling: "touch",
        width: z,
        willChange: "transform"
      }, ce = W > v ? this._scrollbarSize : 0, de = I > z ? this._scrollbarSize : 0;
      return Q.overflowX = I + ce <= z ? "hidden" : "auto", Q.overflowY = W + de <= v ? "hidden" : "auto", /* @__PURE__ */ le.createElement("div", {
        ref: this._setScrollingContainerRef,
        "aria-label": this.props["aria-label"],
        className: rt("ReactVirtualized__Collection", h),
        id: S,
        onScroll: this._onScroll,
        role: "grid",
        style: yi(yi({}, Q), C),
        tabIndex: 0
      }, c > 0 && /* @__PURE__ */ le.createElement("div", {
        className: "ReactVirtualized__Collection__innerScrollContainer",
        style: {
          height: W,
          maxHeight: W,
          maxWidth: I,
          overflow: "hidden",
          pointerEvents: k ? "none" : "",
          width: I
        }
      }, te), c === 0 && b());
    }
    /* ---------------------------- Helper methods ---------------------------- */
    /**
     * Sets an :isScrolling flag for a small window of time.
     * This flag is used to disable pointer events on the scrollable portion of the Collection.
     * This prevents jerky/stuttery mouse-wheel scrolling.
     */
  }, {
    key: "_enablePointerEventsAfterDelay",
    value: function() {
      var e = this;
      this._disablePointerEventsTimeoutId && clearTimeout(this._disablePointerEventsTimeoutId), this._disablePointerEventsTimeoutId = setTimeout(function() {
        var a = e.props.isScrollingChange;
        a(!1), e._disablePointerEventsTimeoutId = null, e.setState({
          isScrolling: !1
        });
      }, ya);
    }
  }, {
    key: "_invokeOnScrollMemoizer",
    value: function(e) {
      var a = this, c = e.scrollLeft, u = e.scrollTop, h = e.totalHeight, v = e.totalWidth;
      this._onScrollMemoizer({
        callback: function(S) {
          var b = S.scrollLeft, C = S.scrollTop, R = a.props, z = R.height, E = R.onScroll, k = R.width;
          E({
            clientHeight: z,
            clientWidth: k,
            scrollHeight: h,
            scrollLeft: b,
            scrollTop: C,
            scrollWidth: v
          });
        },
        indices: {
          scrollLeft: c,
          scrollTop: u
        }
      });
    }
  }, {
    key: "_setScrollPosition",
    value: function(e) {
      var a = e.scrollLeft, c = e.scrollTop, u = {
        scrollPositionChangeReason: kt.REQUESTED
      };
      a >= 0 && (u.scrollLeft = a), c >= 0 && (u.scrollTop = c), (a >= 0 && a !== this.state.scrollLeft || c >= 0 && c !== this.state.scrollTop) && this.setState(u);
    }
  }], [{
    key: "getDerivedStateFromProps",
    value: function(e, a) {
      return e.cellCount === 0 && (a.scrollLeft !== 0 || a.scrollTop !== 0) ? {
        scrollLeft: 0,
        scrollTop: 0,
        scrollPositionChangeReason: kt.REQUESTED
      } : e.scrollLeft !== a.scrollLeft || e.scrollTop !== a.scrollTop ? {
        scrollLeft: e.scrollLeft != null ? e.scrollLeft : a.scrollLeft,
        scrollTop: e.scrollTop != null ? e.scrollTop : a.scrollTop,
        scrollPositionChangeReason: kt.REQUESTED
      } : null;
    }
  }]);
})(le.PureComponent);
O(Cn, "defaultProps", {
  "aria-label": "grid",
  horizontalOverscanSize: 0,
  noContentRenderer: function() {
    return null;
  },
  onScroll: function() {
    return null;
  },
  onSectionRendered: function() {
    return null;
  },
  scrollToAlignment: "auto",
  scrollToCell: -1,
  style: {},
  verticalOverscanSize: 0
});
Cn.propTypes = process.env.NODE_ENV !== "production" ? {
  "aria-label": D.string,
  /**
   * Removes fixed height from the scrollingContainer so that the total height
   * of rows can stretch the window. Intended for use with WindowScroller
   */
  autoHeight: D.bool,
  /**
   * Number of cells in collection.
   */
  cellCount: D.number.isRequired,
  /**
   * Calculates cell sizes and positions and manages rendering the appropriate cells given a specified window.
   */
  cellLayoutManager: D.object.isRequired,
  /**
   * Optional custom CSS class name to attach to root Collection element.
   */
  className: D.string,
  /**
   * Height of Collection; this property determines the number of visible (vs virtualized) rows.
   */
  height: D.number.isRequired,
  /**
   * Optional custom id to attach to root Collection element.
   */
  id: D.string,
  /**
   * Enables the `Collection` to horiontally "overscan" its content similar to how `Grid` does.
   * This can reduce flicker around the edges when a user scrolls quickly.
   */
  horizontalOverscanSize: D.number.isRequired,
  isScrollingChange: D.func,
  /**
   * Optional renderer to be used in place of rows when either :rowCount or :cellCount is 0.
   */
  noContentRenderer: D.func.isRequired,
  /**
   * Callback invoked whenever the scroll offset changes within the inner scrollable region.
   * This callback can be used to sync scrolling between lists, tables, or grids.
   * ({ clientHeight, clientWidth, scrollHeight, scrollLeft, scrollTop, scrollWidth }): void
   */
  onScroll: D.func.isRequired,
  /**
   * Callback invoked with information about the section of the Collection that was just rendered.
   * This callback is passed a named :indices parameter which is an Array of the most recently rendered section indices.
   */
  onSectionRendered: D.func.isRequired,
  /**
   * Horizontal offset.
   */
  scrollLeft: D.number,
  /**
   * Controls scroll-to-cell behavior of the Grid.
   * The default ("auto") scrolls the least amount possible to ensure that the specified cell is fully visible.
   * Use "start" to align cells to the top/left of the Grid and "end" to align bottom/right.
   */
  scrollToAlignment: D.oneOf(["auto", "end", "start", "center"]).isRequired,
  /**
   * Cell index to ensure visible (by forcefully scrolling if necessary).
   */
  scrollToCell: D.number.isRequired,
  /**
   * Vertical offset.
   */
  scrollTop: D.number,
  /**
   * Optional custom inline style to attach to root Collection element.
   */
  style: D.object,
  /**
   * Enables the `Collection` to vertically "overscan" its content similar to how `Grid` does.
   * This can reduce flicker around the edges when a user scrolls quickly.
   */
  verticalOverscanSize: D.number.isRequired,
  /**
   * Width of Collection; this property determines the number of visible (vs virtualized) columns.
   */
  width: D.number.isRequired
} : {};
nn(Cn);
var Sa = /* @__PURE__ */ (function() {
  function s(i) {
    var r = i.height, e = i.width, a = i.x, c = i.y;
    Ge(this, s), this.height = r, this.width = e, this.x = a, this.y = c, this._indexMap = {}, this._indices = [];
  }
  return We(s, [{
    key: "addCellIndex",
    value: function(r) {
      var e = r.index;
      this._indexMap[e] || (this._indexMap[e] = !0, this._indices.push(e));
    }
    /** Get all cell indices that have been added to this section. */
  }, {
    key: "getCellIndices",
    value: function() {
      return this._indices;
    }
    /** Intended for debugger/test purposes only */
  }, {
    key: "toString",
    value: function() {
      return "".concat(this.x, ",").concat(this.y, " ").concat(this.width, "x").concat(this.height);
    }
  }]);
})(), _a = 100, ba = /* @__PURE__ */ (function() {
  function s() {
    var i = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : _a;
    Ge(this, s), this._sectionSize = i, this._cellMetadata = [], this._sections = {};
  }
  return We(s, [{
    key: "getCellIndices",
    value: function(r) {
      var e = r.height, a = r.width, c = r.x, u = r.y, h = {};
      return this.getSections({
        height: e,
        width: a,
        x: c,
        y: u
      }).forEach(function(v) {
        return v.getCellIndices().forEach(function(m) {
          h[m] = m;
        });
      }), Object.keys(h).map(function(v) {
        return h[v];
      });
    }
    /** Get size and position information for the cell specified. */
  }, {
    key: "getCellMetadata",
    value: function(r) {
      var e = r.index;
      return this._cellMetadata[e];
    }
    /** Get all Sections overlapping the specified region. */
  }, {
    key: "getSections",
    value: function(r) {
      for (var e = r.height, a = r.width, c = r.x, u = r.y, h = Math.floor(c / this._sectionSize), v = Math.floor((c + a - 1) / this._sectionSize), m = Math.floor(u / this._sectionSize), S = Math.floor((u + e - 1) / this._sectionSize), b = [], C = h; C <= v; C++)
        for (var R = m; R <= S; R++) {
          var z = "".concat(C, ".").concat(R);
          this._sections[z] || (this._sections[z] = new Sa({
            height: this._sectionSize,
            width: this._sectionSize,
            x: C * this._sectionSize,
            y: R * this._sectionSize
          })), b.push(this._sections[z]);
        }
      return b;
    }
    /** Total number of Sections based on the currently registered cells. */
  }, {
    key: "getTotalSectionCount",
    value: function() {
      return Object.keys(this._sections).length;
    }
    /** Intended for debugger/test purposes only */
  }, {
    key: "toString",
    value: function() {
      var r = this;
      return Object.keys(this._sections).map(function(e) {
        return r._sections[e].toString();
      });
    }
    /** Adds a cell to the appropriate Sections and registers it metadata for later retrievable. */
  }, {
    key: "registerCell",
    value: function(r) {
      var e = r.cellMetadatum, a = r.index;
      this._cellMetadata[a] = e, this.getSections(e).forEach(function(c) {
        return c.addCellIndex({
          index: a
        });
      });
    }
  }]);
})();
function wa(s) {
  for (var i = s.cellCount, r = s.cellSizeAndPositionGetter, e = s.sectionSize, a = [], c = new ba(e), u = 0, h = 0, v = 0; v < i; v++) {
    var m = r({
      index: v
    });
    if (m.height == null || isNaN(m.height) || m.width == null || isNaN(m.width) || m.x == null || isNaN(m.x) || m.y == null || isNaN(m.y))
      throw Error("Invalid metadata returned for cell ".concat(v, `:
        x:`).concat(m.x, ", y:").concat(m.y, ", width:").concat(m.width, ", height:").concat(m.height));
    u = Math.max(u, m.y + m.height), h = Math.max(h, m.x + m.width), a[v] = m, c.registerCell({
      cellMetadatum: m,
      index: v
    });
  }
  return {
    cellMetadata: a,
    height: u,
    sectionManager: c,
    width: h
  };
}
function Si(s) {
  var i = s.align, r = i === void 0 ? "auto" : i, e = s.cellOffset, a = s.cellSize, c = s.containerSize, u = s.currentOffset, h = e, v = h - c + a;
  switch (r) {
    case "start":
      return h;
    case "end":
      return v;
    case "center":
      return h - (c - a) / 2;
    default:
      return Math.max(v, Math.min(h, u));
  }
}
function Ca(s, i, r) {
  return i = ze(i), Xe(s, ao() ? Reflect.construct(i, r || [], ze(s).constructor) : i.apply(s, r));
}
function ao() {
  try {
    var s = !Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function() {
    }));
  } catch {
  }
  return (ao = function() {
    return !!s;
  })();
}
var lo = /* @__PURE__ */ (function(s) {
  function i(r, e) {
    var a;
    return Ge(this, i), a = Ca(this, i, [r, e]), a._cellMetadata = [], a._lastRenderedCellIndices = [], a._cellCache = [], a._isScrollingChange = a._isScrollingChange.bind(a), a._setCollectionViewRef = a._setCollectionViewRef.bind(a), a;
  }
  return Ye(i, s), We(i, [{
    key: "forceUpdate",
    value: function() {
      this._collectionView !== void 0 && this._collectionView.forceUpdate();
    }
    /** See Collection#recomputeCellSizesAndPositions */
  }, {
    key: "recomputeCellSizesAndPositions",
    value: function() {
      this._cellCache = [], this._collectionView.recomputeCellSizesAndPositions();
    }
    /** React lifecycle methods */
  }, {
    key: "render",
    value: function() {
      var e = tt({}, (aa(this.props), this.props));
      return /* @__PURE__ */ le.createElement(Cn, tt({
        cellLayoutManager: this,
        isScrollingChange: this._isScrollingChange,
        ref: this._setCollectionViewRef
      }, e));
    }
    /** CellLayoutManager interface */
  }, {
    key: "calculateSizeAndPositionData",
    value: function() {
      var e = this.props, a = e.cellCount, c = e.cellSizeAndPositionGetter, u = e.sectionSize, h = wa({
        cellCount: a,
        cellSizeAndPositionGetter: c,
        sectionSize: u
      });
      this._cellMetadata = h.cellMetadata, this._sectionManager = h.sectionManager, this._height = h.height, this._width = h.width;
    }
    /**
     * Returns the most recently rendered set of cell indices.
     */
  }, {
    key: "getLastRenderedIndices",
    value: function() {
      return this._lastRenderedCellIndices;
    }
    /**
     * Calculates the minimum amount of change from the current scroll position to ensure the specified cell is (fully) visible.
     */
  }, {
    key: "getScrollPositionForCell",
    value: function(e) {
      var a = e.align, c = e.cellIndex, u = e.height, h = e.scrollLeft, v = e.scrollTop, m = e.width, S = this.props.cellCount;
      if (c >= 0 && c < S) {
        var b = this._cellMetadata[c];
        h = Si({
          align: a,
          cellOffset: b.x,
          cellSize: b.width,
          containerSize: m,
          currentOffset: h
        }), v = Si({
          align: a,
          cellOffset: b.y,
          cellSize: b.height,
          containerSize: u,
          currentOffset: v
        });
      }
      return {
        scrollLeft: h,
        scrollTop: v
      };
    }
  }, {
    key: "getTotalSize",
    value: function() {
      return {
        height: this._height,
        width: this._width
      };
    }
  }, {
    key: "cellRenderers",
    value: function(e) {
      var a = this, c = e.height, u = e.isScrolling, h = e.width, v = e.x, m = e.y, S = this.props, b = S.cellGroupRenderer, C = S.cellRenderer;
      return this._lastRenderedCellIndices = this._sectionManager.getCellIndices({
        height: c,
        width: h,
        x: v,
        y: m
      }), b({
        cellCache: this._cellCache,
        cellRenderer: C,
        cellSizeAndPositionGetter: function(z) {
          var E = z.index;
          return a._sectionManager.getCellMetadata({
            index: E
          });
        },
        indices: this._lastRenderedCellIndices,
        isScrolling: u
      });
    }
  }, {
    key: "_isScrollingChange",
    value: function(e) {
      e || (this._cellCache = []);
    }
  }, {
    key: "_setCollectionViewRef",
    value: function(e) {
      this._collectionView = e;
    }
  }]);
})(le.PureComponent);
O(lo, "defaultProps", {
  "aria-label": "grid",
  cellGroupRenderer: xa
});
lo.propTypes = process.env.NODE_ENV !== "production" ? {
  "aria-label": D.string,
  /**
   * Number of cells in Collection.
   */
  cellCount: D.number.isRequired,
  /**
   * Responsible for rendering a group of cells given their indices.
   * Should implement the following interface: ({
   *   cellSizeAndPositionGetter:Function,
   *   indices: Array<number>,
   *   cellRenderer: Function
   * }): Array<PropTypes.node>
   */
  cellGroupRenderer: D.func.isRequired,
  /**
   * Responsible for rendering a cell given an row and column index.
   * Should implement the following interface: ({ index: number, key: string, style: object }): PropTypes.element
   */
  cellRenderer: D.func.isRequired,
  /**
   * Callback responsible for returning size and offset/position information for a given cell (index).
   * ({ index: number }): { height: number, width: number, x: number, y: number }
   */
  cellSizeAndPositionGetter: D.func.isRequired,
  /**
   * Optionally override the size of the sections a Collection's cells are split into.
   */
  sectionSize: D.number
} : {};
function xa(s) {
  var i = s.cellCache, r = s.cellRenderer, e = s.cellSizeAndPositionGetter, a = s.indices, c = s.isScrolling;
  return a.map(function(u) {
    var h = e({
      index: u
    }), v = {
      index: u,
      isScrolling: c,
      key: u,
      style: {
        height: h.height,
        left: h.x,
        position: "absolute",
        top: h.y,
        width: h.width
      }
    };
    return c ? (u in i || (i[u] = r(v)), i[u]) : r(v);
  }).filter(function(u) {
    return !!u;
  });
}
function Ra(s, i, r) {
  return i = ze(i), Xe(s, co() ? Reflect.construct(i, r || [], ze(s).constructor) : i.apply(s, r));
}
function co() {
  try {
    var s = !Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function() {
    }));
  } catch {
  }
  return (co = function() {
    return !!s;
  })();
}
var Ta = /* @__PURE__ */ (function(s) {
  function i(r, e) {
    var a;
    return Ge(this, i), a = Ra(this, i, [r, e]), a._registerChild = a._registerChild.bind(a), a;
  }
  return Ye(i, s), We(i, [{
    key: "componentDidUpdate",
    value: function(e) {
      var a = this.props, c = a.columnMaxWidth, u = a.columnMinWidth, h = a.columnCount, v = a.width;
      (c !== e.columnMaxWidth || u !== e.columnMinWidth || h !== e.columnCount || v !== e.width) && this._registeredChild && this._registeredChild.recomputeGridSize();
    }
  }, {
    key: "render",
    value: function() {
      var e = this.props, a = e.children, c = e.columnMaxWidth, u = e.columnMinWidth, h = e.columnCount, v = e.width, m = u || 1, S = c ? Math.min(c, v) : v, b = v / h;
      b = Math.max(m, b), b = Math.min(S, b), b = Math.floor(b);
      var C = Math.min(v, b * h);
      return a({
        adjustedWidth: C,
        columnWidth: b,
        getColumnWidth: function() {
          return b;
        },
        registerChild: this._registerChild
      });
    }
  }, {
    key: "_registerChild",
    value: function(e) {
      if (e && typeof e.recomputeGridSize != "function")
        throw Error("Unexpected child type registered; only Grid/MultiGrid children are supported.");
      this._registeredChild = e, this._registeredChild && this._registeredChild.recomputeGridSize();
    }
  }]);
})(le.PureComponent);
Ta.propTypes = process.env.NODE_ENV !== "production" ? {
  /**
   * Function responsible for rendering a virtualized Grid.
   * This function should implement the following signature:
   * ({ adjustedWidth, getColumnWidth, registerChild }) => PropTypes.element
   *
   * The specified :getColumnWidth function should be passed to the Grid's :columnWidth property.
   * The :registerChild should be passed to the Grid's :ref property.
   * The :adjustedWidth property is optional; it reflects the lesser of the overall width or the width of all columns.
   */
  children: D.func.isRequired,
  /** Optional maximum allowed column width */
  columnMaxWidth: D.number,
  /** Optional minimum allowed column width */
  columnMinWidth: D.number,
  /** Number of columns in Grid or Table child */
  columnCount: D.number.isRequired,
  /** Width of Grid or Table child */
  width: D.number.isRequired
} : {};
function _i(s) {
  var i = s.cellCount, r = s.cellSize, e = s.computeMetadataCallback, a = s.computeMetadataCallbackProps, c = s.nextCellsCount, u = s.nextCellSize, h = s.nextScrollToIndex, v = s.scrollToIndex, m = s.updateScrollOffsetForScrollToIndex;
  (i !== c || (typeof r == "number" || typeof u == "number") && r !== u) && (e(a), v >= 0 && v === h && m());
}
function Ia(s, i) {
  if (s == null) return {};
  var r = {};
  for (var e in s) if ({}.hasOwnProperty.call(s, e)) {
    if (i.indexOf(e) !== -1) continue;
    r[e] = s[e];
  }
  return r;
}
function Yt(s, i) {
  if (s == null) return {};
  var r, e, a = Ia(s, i);
  if (Object.getOwnPropertySymbols) {
    var c = Object.getOwnPropertySymbols(s);
    for (e = 0; e < c.length; e++) r = c[e], i.indexOf(r) === -1 && {}.propertyIsEnumerable.call(s, r) && (a[r] = s[r]);
  }
  return a;
}
var za = /* @__PURE__ */ (function() {
  function s(i) {
    var r = i.cellCount, e = i.cellSizeGetter, a = i.estimatedCellSize;
    Ge(this, s), O(this, "_cellSizeAndPositionData", {}), O(this, "_lastMeasuredIndex", -1), O(this, "_lastBatchedIndex", -1), O(this, "_cellCount", void 0), O(this, "_cellSizeGetter", void 0), O(this, "_estimatedCellSize", void 0), this._cellSizeGetter = e, this._cellCount = r, this._estimatedCellSize = a;
  }
  return We(s, [{
    key: "areOffsetsAdjusted",
    value: function() {
      return !1;
    }
  }, {
    key: "configure",
    value: function(r) {
      var e = r.cellCount, a = r.estimatedCellSize, c = r.cellSizeGetter;
      this._cellCount = e, this._estimatedCellSize = a, this._cellSizeGetter = c;
    }
  }, {
    key: "getCellCount",
    value: function() {
      return this._cellCount;
    }
  }, {
    key: "getEstimatedCellSize",
    value: function() {
      return this._estimatedCellSize;
    }
  }, {
    key: "getLastMeasuredIndex",
    value: function() {
      return this._lastMeasuredIndex;
    }
  }, {
    key: "getOffsetAdjustment",
    value: function() {
      return 0;
    }
    /**
     * This method returns the size and position for the cell at the specified index.
     * It just-in-time calculates (or used cached values) for cells leading up to the index.
     */
  }, {
    key: "getSizeAndPositionOfCell",
    value: function(r) {
      if (r < 0 || r >= this._cellCount)
        throw Error("Requested index ".concat(r, " is outside of range 0..").concat(this._cellCount));
      if (r > this._lastMeasuredIndex)
        for (var e = this.getSizeAndPositionOfLastMeasuredCell(), a = e.offset + e.size, c = this._lastMeasuredIndex + 1; c <= r; c++) {
          var u = this._cellSizeGetter({
            index: c
          });
          if (u === void 0 || isNaN(u))
            throw Error("Invalid size returned for cell ".concat(c, " of value ").concat(u));
          u === null ? (this._cellSizeAndPositionData[c] = {
            offset: a,
            size: 0
          }, this._lastBatchedIndex = r) : (this._cellSizeAndPositionData[c] = {
            offset: a,
            size: u
          }, a += u, this._lastMeasuredIndex = r);
        }
      return this._cellSizeAndPositionData[r];
    }
  }, {
    key: "getSizeAndPositionOfLastMeasuredCell",
    value: function() {
      return this._lastMeasuredIndex >= 0 ? this._cellSizeAndPositionData[this._lastMeasuredIndex] : {
        offset: 0,
        size: 0
      };
    }
    /**
     * Total size of all cells being measured.
     * This value will be completely estimated initially.
     * As cells are measured, the estimate will be updated.
     */
  }, {
    key: "getTotalSize",
    value: function() {
      var r = this.getSizeAndPositionOfLastMeasuredCell(), e = r.offset + r.size, a = this._cellCount - this._lastMeasuredIndex - 1, c = a * this._estimatedCellSize;
      return e + c;
    }
    /**
     * Determines a new offset that ensures a certain cell is visible, given the current offset.
     * If the cell is already visible then the current offset will be returned.
     * If the current offset is too great or small, it will be adjusted just enough to ensure the specified index is visible.
     *
     * @param align Desired alignment within container; one of "auto" (default), "start", or "end"
     * @param containerSize Size (width or height) of the container viewport
     * @param currentOffset Container's current (x or y) offset
     * @param totalSize Total size (width or height) of all cells
     * @return Offset to use to ensure the specified cell is visible
     */
  }, {
    key: "getUpdatedOffsetForIndex",
    value: function(r) {
      var e = r.align, a = e === void 0 ? "auto" : e, c = r.containerSize, u = r.currentOffset, h = r.targetIndex;
      if (c <= 0)
        return 0;
      var v = this.getSizeAndPositionOfCell(h), m = v.offset, S = m - c + v.size, b;
      switch (a) {
        case "start":
          b = m;
          break;
        case "end":
          b = S;
          break;
        case "center":
          b = m - (c - v.size) / 2;
          break;
        default:
          b = Math.max(S, Math.min(m, u));
          break;
      }
      var C = this.getTotalSize();
      return Math.max(0, Math.min(C - c, b));
    }
  }, {
    key: "getVisibleCellRange",
    value: function(r) {
      var e = r.containerSize, a = r.offset, c = this.getTotalSize();
      if (c === 0)
        return {};
      var u = a + e, h = this._findNearestCell(a), v = this.getSizeAndPositionOfCell(h);
      a = v.offset + v.size;
      for (var m = h; a < u && m < this._cellCount - 1; )
        m++, a += this.getSizeAndPositionOfCell(m).size;
      return {
        start: h,
        stop: m
      };
    }
    /**
     * Clear all cached values for cells after the specified index.
     * This method should be called for any cell that has changed its size.
     * It will not immediately perform any calculations; they'll be performed the next time getSizeAndPositionOfCell() is called.
     */
  }, {
    key: "resetCell",
    value: function(r) {
      this._lastMeasuredIndex = Math.min(this._lastMeasuredIndex, r - 1);
    }
  }, {
    key: "_binarySearch",
    value: function(r, e, a) {
      for (; e <= r; ) {
        var c = e + Math.floor((r - e) / 2), u = this.getSizeAndPositionOfCell(c).offset;
        if (u === a)
          return c;
        u < a ? e = c + 1 : u > a && (r = c - 1);
      }
      return e > 0 ? e - 1 : 0;
    }
  }, {
    key: "_exponentialSearch",
    value: function(r, e) {
      for (var a = 1; r < this._cellCount && this.getSizeAndPositionOfCell(r).offset < e; )
        r += a, a *= 2;
      return this._binarySearch(Math.min(r, this._cellCount - 1), Math.floor(r / 2), e);
    }
    /**
     * Searches for the cell (index) nearest the specified offset.
     *
     * If no exact match is found the next lowest cell index will be returned.
     * This allows partially visible cells (with offsets just before/above the fold) to be visible.
     */
  }, {
    key: "_findNearestCell",
    value: function(r) {
      if (isNaN(r))
        throw Error("Invalid offset ".concat(r, " specified"));
      r = Math.max(0, r);
      var e = this.getSizeAndPositionOfLastMeasuredCell(), a = Math.max(0, this._lastMeasuredIndex);
      return e.offset >= r ? this._binarySearch(a, 0, r) : this._exponentialSearch(a, r);
    }
  }]);
})(), Ea = 15e5, Oa = 16777100, Pa = function() {
  return typeof window < "u";
}, Ma = function() {
  return !!window.chrome;
}, Aa = function() {
  return Pa() && Ma() ? Oa : Ea;
}, ka = ["maxScrollSize"], bi = /* @__PURE__ */ (function() {
  function s(i) {
    var r = i.maxScrollSize, e = r === void 0 ? Aa() : r, a = Yt(i, ka);
    Ge(this, s), O(this, "_cellSizeAndPositionManager", void 0), O(this, "_maxScrollSize", void 0), this._cellSizeAndPositionManager = new za(a), this._maxScrollSize = e;
  }
  return We(s, [{
    key: "areOffsetsAdjusted",
    value: function() {
      return this._cellSizeAndPositionManager.getTotalSize() > this._maxScrollSize;
    }
  }, {
    key: "configure",
    value: function(r) {
      this._cellSizeAndPositionManager.configure(r);
    }
  }, {
    key: "getCellCount",
    value: function() {
      return this._cellSizeAndPositionManager.getCellCount();
    }
  }, {
    key: "getEstimatedCellSize",
    value: function() {
      return this._cellSizeAndPositionManager.getEstimatedCellSize();
    }
  }, {
    key: "getLastMeasuredIndex",
    value: function() {
      return this._cellSizeAndPositionManager.getLastMeasuredIndex();
    }
    /**
     * Number of pixels a cell at the given position (offset) should be shifted in order to fit within the scaled container.
     * The offset passed to this function is scaled (safe) as well.
     */
  }, {
    key: "getOffsetAdjustment",
    value: function(r) {
      var e = r.containerSize, a = r.offset, c = this._cellSizeAndPositionManager.getTotalSize(), u = this.getTotalSize(), h = this._getOffsetPercentage({
        containerSize: e,
        offset: a,
        totalSize: u
      });
      return Math.round(h * (u - c));
    }
  }, {
    key: "getSizeAndPositionOfCell",
    value: function(r) {
      return this._cellSizeAndPositionManager.getSizeAndPositionOfCell(r);
    }
  }, {
    key: "getSizeAndPositionOfLastMeasuredCell",
    value: function() {
      return this._cellSizeAndPositionManager.getSizeAndPositionOfLastMeasuredCell();
    }
    /** See CellSizeAndPositionManager#getTotalSize */
  }, {
    key: "getTotalSize",
    value: function() {
      return Math.min(this._maxScrollSize, this._cellSizeAndPositionManager.getTotalSize());
    }
    /** See CellSizeAndPositionManager#getUpdatedOffsetForIndex */
  }, {
    key: "getUpdatedOffsetForIndex",
    value: function(r) {
      var e = r.align, a = e === void 0 ? "auto" : e, c = r.containerSize, u = r.currentOffset, h = r.targetIndex;
      u = this._safeOffsetToOffset({
        containerSize: c,
        offset: u
      });
      var v = this._cellSizeAndPositionManager.getUpdatedOffsetForIndex({
        align: a,
        containerSize: c,
        currentOffset: u,
        targetIndex: h
      });
      return this._offsetToSafeOffset({
        containerSize: c,
        offset: v
      });
    }
    /** See CellSizeAndPositionManager#getVisibleCellRange */
  }, {
    key: "getVisibleCellRange",
    value: function(r) {
      var e = r.containerSize, a = r.offset;
      return a = this._safeOffsetToOffset({
        containerSize: e,
        offset: a
      }), this._cellSizeAndPositionManager.getVisibleCellRange({
        containerSize: e,
        offset: a
      });
    }
  }, {
    key: "resetCell",
    value: function(r) {
      this._cellSizeAndPositionManager.resetCell(r);
    }
  }, {
    key: "_getOffsetPercentage",
    value: function(r) {
      var e = r.containerSize, a = r.offset, c = r.totalSize;
      return c <= e ? 0 : a / (c - e);
    }
  }, {
    key: "_offsetToSafeOffset",
    value: function(r) {
      var e = r.containerSize, a = r.offset, c = this._cellSizeAndPositionManager.getTotalSize(), u = this.getTotalSize();
      if (c === u)
        return a;
      var h = this._getOffsetPercentage({
        containerSize: e,
        offset: a,
        totalSize: c
      });
      return Math.round(h * (u - e));
    }
  }, {
    key: "_safeOffsetToOffset",
    value: function(r) {
      var e = r.containerSize, a = r.offset, c = this._cellSizeAndPositionManager.getTotalSize(), u = this.getTotalSize();
      if (c === u)
        return a;
      var h = this._getOffsetPercentage({
        containerSize: e,
        offset: a,
        totalSize: u
      });
      return Math.round(h * (c - e));
    }
  }]);
})(), yn = -1, vt = 1;
function Da(s) {
  var i = s.cellCount, r = s.overscanCellsCount, e = s.scrollDirection, a = s.startIndex, c = s.stopIndex;
  return e === vt ? {
    overscanStartIndex: Math.max(0, a),
    overscanStopIndex: Math.min(i - 1, c + r)
  } : {
    overscanStartIndex: Math.max(0, a - r),
    overscanStopIndex: Math.min(i - 1, c)
  };
}
function wi(s) {
  var i = s.cellSize, r = s.cellSizeAndPositionManager, e = s.previousCellsCount, a = s.previousCellSize, c = s.previousScrollToAlignment, u = s.previousScrollToIndex, h = s.previousSize, v = s.scrollOffset, m = s.scrollToAlignment, S = s.scrollToIndex, b = s.size, C = s.sizeJustIncreasedFromZero, R = s.updateScrollIndexCallback, z = r.getCellCount(), E = S >= 0 && S < z, k = b !== h || C || !a || typeof i == "number" && i !== a;
  E && (k || m !== c || S !== u) ? R(S) : !E && z > 0 && (b < h || z < e) && v > r.getTotalSize() - b && R(z - 1);
}
function La(s) {
  for (var i = s.cellCache, r = s.cellRenderer, e = s.columnSizeAndPositionManager, a = s.columnStartIndex, c = s.columnStopIndex, u = s.deferredMeasurementCache, h = s.horizontalOffsetAdjustment, v = s.isScrolling, m = s.isScrollingOptOut, S = s.parent, b = s.rowSizeAndPositionManager, C = s.rowStartIndex, R = s.rowStopIndex, z = s.styleCache, E = s.verticalOffsetAdjustment, k = s.visibleColumnIndices, L = s.visibleRowIndices, q = [], P = e.areOffsetsAdjusted() || b.areOffsetsAdjusted(), W = !v && !P, I = C; I <= R; I++)
    for (var V = b.getSizeAndPositionOfCell(I), x = a; x <= c; x++) {
      var j = e.getSizeAndPositionOfCell(x), ie = x >= k.start && x <= k.stop && I >= L.start && I <= L.stop, te = "".concat(I, "-").concat(x), Q = void 0;
      W && z[te] ? Q = z[te] : u && !u.has(I, x) ? Q = {
        height: "auto",
        left: 0,
        position: "absolute",
        top: 0,
        width: "auto"
      } : (Q = {
        height: V.size,
        left: j.offset + h,
        position: "absolute",
        top: V.offset + E,
        width: j.size
      }, z[te] = Q);
      var ce = {
        columnIndex: x,
        isScrolling: v,
        isVisible: ie,
        key: te,
        parent: S,
        rowIndex: I,
        style: Q
      }, de = void 0;
      (m || v) && !h && !E ? (i[te] || (i[te] = r(ce)), de = i[te]) : de = r(ce), !(de == null || de === !1) && (process.env.NODE_ENV !== "production" && Ga(S, de), de.props.role || (de = /* @__PURE__ */ Jt.cloneElement(de, {
        role: "gridcell"
      })), q.push(de));
    }
  return q;
}
function Ga(s, i) {
  process.env.NODE_ENV !== "production" && i && (i.type && i.type.__internalCellMeasurerFlag && (i = i.props.children), i && i.props && i.props.style === void 0 && s.__warnedAboutMissingStyle !== !0 && (s.__warnedAboutMissingStyle = !0, console.warn("Rendered cell should include style property for positioning.")));
}
var Ve;
typeof window < "u" ? Ve = window : typeof self < "u" ? Ve = self : Ve = {};
var Wa = Ve.requestAnimationFrame || Ve.webkitRequestAnimationFrame || Ve.mozRequestAnimationFrame || Ve.oRequestAnimationFrame || Ve.msRequestAnimationFrame || function(s) {
  return Ve.setTimeout(s, 1e3 / 60);
}, ja = Ve.cancelAnimationFrame || Ve.webkitCancelAnimationFrame || Ve.mozCancelAnimationFrame || Ve.oCancelAnimationFrame || Ve.msCancelAnimationFrame || function(s) {
  Ve.clearTimeout(s);
}, Ci = Wa, Fa = ja, Wt = function(i) {
  return Fa(i.id);
}, dr = function(i, r) {
  var e;
  Promise.resolve().then(function() {
    e = Date.now();
  });
  var a = function() {
    Date.now() - e >= r ? i.call() : c.id = Ci(a);
  }, c = {
    id: Ci(a)
  };
  return c;
};
function xi(s, i) {
  var r = Object.keys(s);
  if (Object.getOwnPropertySymbols) {
    var e = Object.getOwnPropertySymbols(s);
    i && (e = e.filter(function(a) {
      return Object.getOwnPropertyDescriptor(s, a).enumerable;
    })), r.push.apply(r, e);
  }
  return r;
}
function Ze(s) {
  for (var i = 1; i < arguments.length; i++) {
    var r = arguments[i] != null ? arguments[i] : {};
    i % 2 ? xi(Object(r), !0).forEach(function(e) {
      O(s, e, r[e]);
    }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(s, Object.getOwnPropertyDescriptors(r)) : xi(Object(r)).forEach(function(e) {
      Object.defineProperty(s, e, Object.getOwnPropertyDescriptor(r, e));
    });
  }
  return s;
}
function Na(s, i, r) {
  return i = ze(i), Xe(s, uo() ? Reflect.construct(i, r || [], ze(s).constructor) : i.apply(s, r));
}
function uo() {
  try {
    var s = !Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function() {
    }));
  } catch {
  }
  return (uo = function() {
    return !!s;
  })();
}
var Ha = 150, Xn = {
  OBSERVED: "observed",
  REQUESTED: "requested"
}, $a = function() {
  return null;
}, lt = /* @__PURE__ */ (function(s) {
  function i(r) {
    var e;
    Ge(this, i), e = Na(this, i, [r]), O(e, "_onGridRenderedMemoizer", Gt()), O(e, "_onScrollMemoizer", Gt(!1)), O(e, "_deferredInvalidateColumnIndex", null), O(e, "_deferredInvalidateRowIndex", null), O(e, "_recomputeScrollLeftFlag", !1), O(e, "_recomputeScrollTopFlag", !1), O(e, "_horizontalScrollBarSize", 0), O(e, "_verticalScrollBarSize", 0), O(e, "_scrollbarPresenceChanged", !1), O(e, "_scrollingContainer", void 0), O(e, "_childrenToDisplay", void 0), O(e, "_columnStartIndex", void 0), O(e, "_columnStopIndex", void 0), O(e, "_rowStartIndex", void 0), O(e, "_rowStopIndex", void 0), O(e, "_renderedColumnStartIndex", 0), O(e, "_renderedColumnStopIndex", 0), O(e, "_renderedRowStartIndex", 0), O(e, "_renderedRowStopIndex", 0), O(e, "_initialScrollTop", void 0), O(e, "_initialScrollLeft", void 0), O(e, "_disablePointerEventsTimeoutId", void 0), O(e, "_styleCache", {}), O(e, "_cellCache", {}), O(e, "_debounceScrollEndedCallback", function() {
      e._disablePointerEventsTimeoutId = null, e.setState({
        isScrolling: !1,
        needToResetStyleCache: !1
      });
    }), O(e, "_invokeOnGridRenderedHelper", function() {
      var u = e.props.onSectionRendered;
      e._onGridRenderedMemoizer({
        callback: u,
        indices: {
          columnOverscanStartIndex: e._columnStartIndex,
          columnOverscanStopIndex: e._columnStopIndex,
          columnStartIndex: e._renderedColumnStartIndex,
          columnStopIndex: e._renderedColumnStopIndex,
          rowOverscanStartIndex: e._rowStartIndex,
          rowOverscanStopIndex: e._rowStopIndex,
          rowStartIndex: e._renderedRowStartIndex,
          rowStopIndex: e._renderedRowStopIndex
        }
      });
    }), O(e, "_setScrollingContainerRef", function(u) {
      e._scrollingContainer = u, typeof e.props.elementRef == "function" ? e.props.elementRef(u) : Ot(e.props.elementRef) === "object" && (e.props.elementRef.current = u);
    }), O(e, "_onScroll", function(u) {
      u.target === e._scrollingContainer && e.handleScrollEvent(u.target);
    });
    var a = new bi({
      cellCount: r.columnCount,
      cellSizeGetter: function(h) {
        return i._wrapSizeGetter(r.columnWidth)(h);
      },
      estimatedCellSize: i._getEstimatedColumnSize(r)
    }), c = new bi({
      cellCount: r.rowCount,
      cellSizeGetter: function(h) {
        return i._wrapSizeGetter(r.rowHeight)(h);
      },
      estimatedCellSize: i._getEstimatedRowSize(r)
    });
    return e.state = {
      instanceProps: {
        columnSizeAndPositionManager: a,
        rowSizeAndPositionManager: c,
        prevColumnWidth: r.columnWidth,
        prevRowHeight: r.rowHeight,
        prevColumnCount: r.columnCount,
        prevRowCount: r.rowCount,
        prevIsScrolling: r.isScrolling === !0,
        prevScrollToColumn: r.scrollToColumn,
        prevScrollToRow: r.scrollToRow,
        scrollbarSize: 0,
        scrollbarSizeMeasured: !1
      },
      isScrolling: !1,
      scrollDirectionHorizontal: vt,
      scrollDirectionVertical: vt,
      scrollLeft: 0,
      scrollTop: 0,
      scrollPositionChangeReason: null,
      needToResetStyleCache: !1
    }, r.scrollToRow > 0 && (e._initialScrollTop = e._getCalculatedScrollTop(r, e.state)), r.scrollToColumn > 0 && (e._initialScrollLeft = e._getCalculatedScrollLeft(r, e.state)), e;
  }
  return Ye(i, s), We(i, [{
    key: "getOffsetForCell",
    value: function() {
      var e = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : {}, a = e.alignment, c = a === void 0 ? this.props.scrollToAlignment : a, u = e.columnIndex, h = u === void 0 ? this.props.scrollToColumn : u, v = e.rowIndex, m = v === void 0 ? this.props.scrollToRow : v, S = Ze(Ze({}, this.props), {}, {
        scrollToAlignment: c,
        scrollToColumn: h,
        scrollToRow: m
      });
      return {
        scrollLeft: this._getCalculatedScrollLeft(S),
        scrollTop: this._getCalculatedScrollTop(S)
      };
    }
    /**
     * Gets estimated total rows' height.
     */
  }, {
    key: "getTotalRowsHeight",
    value: function() {
      return this.state.instanceProps.rowSizeAndPositionManager.getTotalSize();
    }
    /**
     * Gets estimated total columns' width.
     */
  }, {
    key: "getTotalColumnsWidth",
    value: function() {
      return this.state.instanceProps.columnSizeAndPositionManager.getTotalSize();
    }
    /**
     * This method handles a scroll event originating from an external scroll control.
     * It's an advanced method and should probably not be used unless you're implementing a custom scroll-bar solution.
     */
  }, {
    key: "handleScrollEvent",
    value: function(e) {
      var a = e.scrollLeft, c = a === void 0 ? 0 : a, u = e.scrollTop, h = u === void 0 ? 0 : u;
      if (!(h < 0)) {
        this._debounceScrollEnded();
        var v = this.props, m = v.autoHeight, S = v.autoWidth, b = v.height, C = v.width, R = this.state.instanceProps, z = R.scrollbarSize, E = R.rowSizeAndPositionManager.getTotalSize(), k = R.columnSizeAndPositionManager.getTotalSize(), L = Math.min(Math.max(0, k - C + z), c), q = Math.min(Math.max(0, E - b + z), h);
        if (this.state.scrollLeft !== L || this.state.scrollTop !== q) {
          var P = L !== this.state.scrollLeft ? L > this.state.scrollLeft ? vt : yn : this.state.scrollDirectionHorizontal, W = q !== this.state.scrollTop ? q > this.state.scrollTop ? vt : yn : this.state.scrollDirectionVertical, I = {
            isScrolling: !0,
            scrollDirectionHorizontal: P,
            scrollDirectionVertical: W,
            scrollPositionChangeReason: Xn.OBSERVED
          };
          m || (I.scrollTop = q), S || (I.scrollLeft = L), I.needToResetStyleCache = !1, this.setState(I);
        }
        this._invokeOnScrollMemoizer({
          scrollLeft: L,
          scrollTop: q,
          totalColumnsWidth: k,
          totalRowsHeight: E
        });
      }
    }
    /**
     * Invalidate Grid size and recompute visible cells.
     * This is a deferred wrapper for recomputeGridSize().
     * It sets a flag to be evaluated on cDM/cDU to avoid unnecessary renders.
     * This method is intended for advanced use-cases like CellMeasurer.
     */
    // @TODO (bvaughn) Add automated test coverage for this.
  }, {
    key: "invalidateCellSizeAfterRender",
    value: function(e) {
      var a = e.columnIndex, c = e.rowIndex;
      this._deferredInvalidateColumnIndex = typeof this._deferredInvalidateColumnIndex == "number" ? Math.min(this._deferredInvalidateColumnIndex, a) : a, this._deferredInvalidateRowIndex = typeof this._deferredInvalidateRowIndex == "number" ? Math.min(this._deferredInvalidateRowIndex, c) : c;
    }
    /**
     * Pre-measure all columns and rows in a Grid.
     * Typically cells are only measured as needed and estimated sizes are used for cells that have not yet been measured.
     * This method ensures that the next call to getTotalSize() returns an exact size (as opposed to just an estimated one).
     */
  }, {
    key: "measureAllCells",
    value: function() {
      var e = this.props, a = e.columnCount, c = e.rowCount, u = this.state.instanceProps;
      u.columnSizeAndPositionManager.getSizeAndPositionOfCell(a - 1), u.rowSizeAndPositionManager.getSizeAndPositionOfCell(c - 1);
    }
    /**
     * Forced recompute of row heights and column widths.
     * This function should be called if dynamic column or row sizes have changed but nothing else has.
     * Since Grid only receives :columnCount and :rowCount it has no way of detecting when the underlying data changes.
     */
  }, {
    key: "recomputeGridSize",
    value: function() {
      var e = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : {}, a = e.columnIndex, c = a === void 0 ? 0 : a, u = e.rowIndex, h = u === void 0 ? 0 : u, v = this.props, m = v.scrollToColumn, S = v.scrollToRow, b = this.state.instanceProps;
      b.columnSizeAndPositionManager.resetCell(c), b.rowSizeAndPositionManager.resetCell(h), this._recomputeScrollLeftFlag = m >= 0 && (this.state.scrollDirectionHorizontal === vt ? c <= m : c >= m), this._recomputeScrollTopFlag = S >= 0 && (this.state.scrollDirectionVertical === vt ? h <= S : h >= S), this._styleCache = {}, this._cellCache = {}, this.forceUpdate();
    }
    /**
     * Ensure column and row are visible.
     */
  }, {
    key: "scrollToCell",
    value: function(e) {
      var a = e.columnIndex, c = e.rowIndex, u = this.props.columnCount, h = this.props;
      u > 1 && a !== void 0 && this._updateScrollLeftForScrollToColumn(Ze(Ze({}, h), {}, {
        scrollToColumn: a
      })), c !== void 0 && this._updateScrollTopForScrollToRow(Ze(Ze({}, h), {}, {
        scrollToRow: c
      }));
    }
  }, {
    key: "componentDidMount",
    value: function() {
      var e = this.props, a = e.getScrollbarSize, c = e.height, u = e.scrollLeft, h = e.scrollToColumn, v = e.scrollTop, m = e.scrollToRow, S = e.width, b = this.state.instanceProps;
      if (this._initialScrollTop = 0, this._initialScrollLeft = 0, this._handleInvalidatedGridSize(), b.scrollbarSizeMeasured || this.setState(function(z) {
        var E = Ze(Ze({}, z), {}, {
          needToResetStyleCache: !1
        });
        return E.instanceProps.scrollbarSize = a(), E.instanceProps.scrollbarSizeMeasured = !0, E;
      }), typeof u == "number" && u >= 0 || typeof v == "number" && v >= 0) {
        var C = i._getScrollToPositionStateUpdate({
          prevState: this.state,
          scrollLeft: u,
          scrollTop: v
        });
        C && (C.needToResetStyleCache = !1, this.setState(C));
      }
      this._scrollingContainer && (this._scrollingContainer.scrollLeft !== this.state.scrollLeft && (this._scrollingContainer.scrollLeft = this.state.scrollLeft), this._scrollingContainer.scrollTop !== this.state.scrollTop && (this._scrollingContainer.scrollTop = this.state.scrollTop));
      var R = c > 0 && S > 0;
      h >= 0 && R && this._updateScrollLeftForScrollToColumn(), m >= 0 && R && this._updateScrollTopForScrollToRow(), this._invokeOnGridRenderedHelper(), this._invokeOnScrollMemoizer({
        scrollLeft: u || 0,
        scrollTop: v || 0,
        totalColumnsWidth: b.columnSizeAndPositionManager.getTotalSize(),
        totalRowsHeight: b.rowSizeAndPositionManager.getTotalSize()
      }), this._maybeCallOnScrollbarPresenceChange();
    }
    /**
     * @private
     * This method updates scrollLeft/scrollTop in state for the following conditions:
     * 1) New scroll-to-cell props have been set
     */
  }, {
    key: "componentDidUpdate",
    value: function(e, a) {
      var c = this, u = this.props, h = u.autoHeight, v = u.autoWidth, m = u.columnCount, S = u.height, b = u.rowCount, C = u.scrollToAlignment, R = u.scrollToColumn, z = u.scrollToRow, E = u.width, k = this.state, L = k.scrollLeft, q = k.scrollPositionChangeReason, P = k.scrollTop, W = k.instanceProps;
      this._handleInvalidatedGridSize();
      var I = m > 0 && e.columnCount === 0 || b > 0 && e.rowCount === 0;
      q === Xn.REQUESTED && (!v && L >= 0 && (L !== this._scrollingContainer.scrollLeft || I) && (this._scrollingContainer.scrollLeft = L), !h && P >= 0 && (P !== this._scrollingContainer.scrollTop || I) && (this._scrollingContainer.scrollTop = P));
      var V = (e.width === 0 || e.height === 0) && S > 0 && E > 0;
      if (this._recomputeScrollLeftFlag ? (this._recomputeScrollLeftFlag = !1, this._updateScrollLeftForScrollToColumn(this.props)) : wi({
        cellSizeAndPositionManager: W.columnSizeAndPositionManager,
        previousCellsCount: e.columnCount,
        previousCellSize: e.columnWidth,
        previousScrollToAlignment: e.scrollToAlignment,
        previousScrollToIndex: e.scrollToColumn,
        previousSize: e.width,
        scrollOffset: L,
        scrollToAlignment: C,
        scrollToIndex: R,
        size: E,
        sizeJustIncreasedFromZero: V,
        updateScrollIndexCallback: function() {
          return c._updateScrollLeftForScrollToColumn(c.props);
        }
      }), this._recomputeScrollTopFlag ? (this._recomputeScrollTopFlag = !1, this._updateScrollTopForScrollToRow(this.props)) : wi({
        cellSizeAndPositionManager: W.rowSizeAndPositionManager,
        previousCellsCount: e.rowCount,
        previousCellSize: e.rowHeight,
        previousScrollToAlignment: e.scrollToAlignment,
        previousScrollToIndex: e.scrollToRow,
        previousSize: e.height,
        scrollOffset: P,
        scrollToAlignment: C,
        scrollToIndex: z,
        size: S,
        sizeJustIncreasedFromZero: V,
        updateScrollIndexCallback: function() {
          return c._updateScrollTopForScrollToRow(c.props);
        }
      }), this._invokeOnGridRenderedHelper(), L !== a.scrollLeft || P !== a.scrollTop) {
        var x = W.rowSizeAndPositionManager.getTotalSize(), j = W.columnSizeAndPositionManager.getTotalSize();
        this._invokeOnScrollMemoizer({
          scrollLeft: L,
          scrollTop: P,
          totalColumnsWidth: j,
          totalRowsHeight: x
        });
      }
      this._maybeCallOnScrollbarPresenceChange();
    }
  }, {
    key: "componentWillUnmount",
    value: function() {
      this._disablePointerEventsTimeoutId && Wt(this._disablePointerEventsTimeoutId);
    }
    /**
     * This method updates scrollLeft/scrollTop in state for the following conditions:
     * 1) Empty content (0 rows or columns)
     * 2) New scroll props overriding the current state
     * 3) Cells-count or cells-size has changed, making previous scroll offsets invalid
     */
  }, {
    key: "render",
    value: function() {
      var e = this.props, a = e.autoContainerWidth, c = e.autoHeight, u = e.autoWidth, h = e.className, v = e.containerProps, m = e.containerRole, S = e.containerStyle, b = e.height, C = e.id, R = e.noContentRenderer, z = e.role, E = e.style, k = e.tabIndex, L = e.width, q = this.state, P = q.instanceProps, W = q.needToResetStyleCache, I = this._isScrolling(), V = {
        boxSizing: "border-box",
        direction: "ltr",
        height: c ? "auto" : b,
        position: "relative",
        width: u ? "auto" : L,
        WebkitOverflowScrolling: "touch",
        willChange: "transform"
      };
      W && (this._styleCache = {}), this.state.isScrolling || this._resetStyleCache(), this._calculateChildrenToRender(this.props, this.state);
      var x = P.columnSizeAndPositionManager.getTotalSize(), j = P.rowSizeAndPositionManager.getTotalSize(), ie = j > b ? P.scrollbarSize : 0, te = x > L ? P.scrollbarSize : 0;
      (te !== this._horizontalScrollBarSize || ie !== this._verticalScrollBarSize) && (this._horizontalScrollBarSize = te, this._verticalScrollBarSize = ie, this._scrollbarPresenceChanged = !0), V.overflowX = x + ie <= L ? "hidden" : "auto", V.overflowY = j + te <= b ? "hidden" : "auto";
      var Q = this._childrenToDisplay, ce = Q.length === 0 && b > 0 && L > 0;
      return /* @__PURE__ */ le.createElement("div", tt({
        ref: this._setScrollingContainerRef
      }, v, {
        "aria-label": this.props["aria-label"],
        "aria-readonly": this.props["aria-readonly"],
        className: rt("ReactVirtualized__Grid", h),
        id: C,
        onScroll: this._onScroll,
        role: z,
        style: Ze(Ze({}, V), E),
        tabIndex: k
      }), Q.length > 0 && /* @__PURE__ */ le.createElement("div", {
        className: "ReactVirtualized__Grid__innerScrollContainer",
        role: m,
        style: Ze({
          width: a ? "auto" : x,
          height: j,
          maxWidth: x,
          maxHeight: j,
          overflow: "hidden",
          pointerEvents: I ? "none" : "",
          position: "relative"
        }, S)
      }, Q), ce && R());
    }
    /* ---------------------------- Helper methods ---------------------------- */
  }, {
    key: "_calculateChildrenToRender",
    value: function() {
      var e = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : this.props, a = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : this.state, c = e.cellRenderer, u = e.cellRangeRenderer, h = e.columnCount, v = e.deferredMeasurementCache, m = e.height, S = e.overscanColumnCount, b = e.overscanIndicesGetter, C = e.overscanRowCount, R = e.rowCount, z = e.width, E = e.isScrollingOptOut, k = a.scrollDirectionHorizontal, L = a.scrollDirectionVertical, q = a.instanceProps, P = this._initialScrollTop > 0 ? this._initialScrollTop : a.scrollTop, W = this._initialScrollLeft > 0 ? this._initialScrollLeft : a.scrollLeft, I = this._isScrolling(e, a);
      if (this._childrenToDisplay = [], m > 0 && z > 0) {
        var V = q.columnSizeAndPositionManager.getVisibleCellRange({
          containerSize: z,
          offset: W
        }), x = q.rowSizeAndPositionManager.getVisibleCellRange({
          containerSize: m,
          offset: P
        }), j = q.columnSizeAndPositionManager.getOffsetAdjustment({
          containerSize: z,
          offset: W
        }), ie = q.rowSizeAndPositionManager.getOffsetAdjustment({
          containerSize: m,
          offset: P
        });
        this._renderedColumnStartIndex = V.start, this._renderedColumnStopIndex = V.stop, this._renderedRowStartIndex = x.start, this._renderedRowStopIndex = x.stop;
        var te = b({
          direction: "horizontal",
          cellCount: h,
          overscanCellsCount: S,
          scrollDirection: k,
          startIndex: typeof V.start == "number" ? V.start : 0,
          stopIndex: typeof V.stop == "number" ? V.stop : -1
        }), Q = b({
          direction: "vertical",
          cellCount: R,
          overscanCellsCount: C,
          scrollDirection: L,
          startIndex: typeof x.start == "number" ? x.start : 0,
          stopIndex: typeof x.stop == "number" ? x.stop : -1
        }), ce = te.overscanStartIndex, de = te.overscanStopIndex, he = Q.overscanStartIndex, pe = Q.overscanStopIndex;
        if (v) {
          if (!v.hasFixedHeight()) {
            for (var Se = he; Se <= pe; Se++)
              if (!v.has(Se, 0)) {
                ce = 0, de = h - 1;
                break;
              }
          }
          if (!v.hasFixedWidth()) {
            for (var Te = ce; Te <= de; Te++)
              if (!v.has(0, Te)) {
                he = 0, pe = R - 1;
                break;
              }
          }
        }
        this._childrenToDisplay = u({
          cellCache: this._cellCache,
          cellRenderer: c,
          columnSizeAndPositionManager: q.columnSizeAndPositionManager,
          columnStartIndex: ce,
          columnStopIndex: de,
          deferredMeasurementCache: v,
          horizontalOffsetAdjustment: j,
          isScrolling: I,
          isScrollingOptOut: E,
          parent: this,
          rowSizeAndPositionManager: q.rowSizeAndPositionManager,
          rowStartIndex: he,
          rowStopIndex: pe,
          scrollLeft: W,
          scrollTop: P,
          styleCache: this._styleCache,
          verticalOffsetAdjustment: ie,
          visibleColumnIndices: V,
          visibleRowIndices: x
        }), this._columnStartIndex = ce, this._columnStopIndex = de, this._rowStartIndex = he, this._rowStopIndex = pe;
      }
    }
    /**
     * Sets an :isScrolling flag for a small window of time.
     * This flag is used to disable pointer events on the scrollable portion of the Grid.
     * This prevents jerky/stuttery mouse-wheel scrolling.
     */
  }, {
    key: "_debounceScrollEnded",
    value: function() {
      var e = this.props.scrollingResetTimeInterval;
      this._disablePointerEventsTimeoutId && Wt(this._disablePointerEventsTimeoutId), this._disablePointerEventsTimeoutId = dr(this._debounceScrollEndedCallback, e);
    }
  }, {
    key: "_handleInvalidatedGridSize",
    value: (
      /**
       * Check for batched CellMeasurer size invalidations.
       * This will occur the first time one or more previously unmeasured cells are rendered.
       */
      function() {
        if (typeof this._deferredInvalidateColumnIndex == "number" && typeof this._deferredInvalidateRowIndex == "number") {
          var e = this._deferredInvalidateColumnIndex, a = this._deferredInvalidateRowIndex;
          this._deferredInvalidateColumnIndex = null, this._deferredInvalidateRowIndex = null, this.recomputeGridSize({
            columnIndex: e,
            rowIndex: a
          });
        }
      }
    )
  }, {
    key: "_invokeOnScrollMemoizer",
    value: function(e) {
      var a = this, c = e.scrollLeft, u = e.scrollTop, h = e.totalColumnsWidth, v = e.totalRowsHeight;
      this._onScrollMemoizer({
        callback: function(S) {
          var b = S.scrollLeft, C = S.scrollTop, R = a.props, z = R.height, E = R.onScroll, k = R.width;
          E({
            clientHeight: z,
            clientWidth: k,
            scrollHeight: v,
            scrollLeft: b,
            scrollTop: C,
            scrollWidth: h
          });
        },
        indices: {
          scrollLeft: c,
          scrollTop: u
        }
      });
    }
  }, {
    key: "_isScrolling",
    value: function() {
      var e = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : this.props, a = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : this.state;
      return Object.hasOwnProperty.call(e, "isScrolling") ? !!e.isScrolling : !!a.isScrolling;
    }
  }, {
    key: "_maybeCallOnScrollbarPresenceChange",
    value: function() {
      if (this._scrollbarPresenceChanged) {
        var e = this.props.onScrollbarPresenceChange;
        this._scrollbarPresenceChanged = !1, e({
          horizontal: this._horizontalScrollBarSize > 0,
          size: this.state.instanceProps.scrollbarSize,
          vertical: this._verticalScrollBarSize > 0
        });
      }
    }
  }, {
    key: "scrollToPosition",
    value: (
      /**
       * Scroll to the specified offset(s).
       * Useful for animating position changes.
       */
      function(e) {
        var a = e.scrollLeft, c = e.scrollTop, u = i._getScrollToPositionStateUpdate({
          prevState: this.state,
          scrollLeft: a,
          scrollTop: c
        });
        u && (u.needToResetStyleCache = !1, this.setState(u));
      }
    )
  }, {
    key: "_getCalculatedScrollLeft",
    value: function() {
      var e = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : this.props, a = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : this.state;
      return i._getCalculatedScrollLeft(e, a);
    }
  }, {
    key: "_updateScrollLeftForScrollToColumn",
    value: function() {
      var e = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : this.props, a = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : this.state, c = i._getScrollLeftForScrollToColumnStateUpdate(e, a);
      c && (c.needToResetStyleCache = !1, this.setState(c));
    }
  }, {
    key: "_getCalculatedScrollTop",
    value: function() {
      var e = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : this.props, a = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : this.state;
      return i._getCalculatedScrollTop(e, a);
    }
  }, {
    key: "_resetStyleCache",
    value: function() {
      var e = this._styleCache, a = this._cellCache, c = this.props.isScrollingOptOut;
      this._cellCache = {}, this._styleCache = {};
      for (var u = this._rowStartIndex; u <= this._rowStopIndex; u++)
        for (var h = this._columnStartIndex; h <= this._columnStopIndex; h++) {
          var v = "".concat(u, "-").concat(h);
          this._styleCache[v] = e[v], c && (this._cellCache[v] = a[v]);
        }
    }
  }, {
    key: "_updateScrollTopForScrollToRow",
    value: function() {
      var e = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : this.props, a = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : this.state, c = i._getScrollTopForScrollToRowStateUpdate(e, a);
      c && (c.needToResetStyleCache = !1, this.setState(c));
    }
  }], [{
    key: "getDerivedStateFromProps",
    value: function(e, a) {
      var c = {};
      e.columnCount === 0 && a.scrollLeft !== 0 || e.rowCount === 0 && a.scrollTop !== 0 ? (c.scrollLeft = 0, c.scrollTop = 0) : (e.scrollLeft !== a.scrollLeft && e.scrollToColumn < 0 || e.scrollTop !== a.scrollTop && e.scrollToRow < 0) && Object.assign(c, i._getScrollToPositionStateUpdate({
        prevState: a,
        scrollLeft: e.scrollLeft,
        scrollTop: e.scrollTop
      }));
      var u = a.instanceProps;
      c.needToResetStyleCache = !1, (e.columnWidth !== u.prevColumnWidth || e.rowHeight !== u.prevRowHeight) && (c.needToResetStyleCache = !0), u.columnSizeAndPositionManager.configure({
        cellCount: e.columnCount,
        estimatedCellSize: i._getEstimatedColumnSize(e),
        cellSizeGetter: i._wrapSizeGetter(e.columnWidth)
      }), u.rowSizeAndPositionManager.configure({
        cellCount: e.rowCount,
        estimatedCellSize: i._getEstimatedRowSize(e),
        cellSizeGetter: i._wrapSizeGetter(e.rowHeight)
      }), (u.prevColumnCount === 0 || u.prevRowCount === 0) && (u.prevColumnCount = 0, u.prevRowCount = 0), e.autoHeight && e.isScrolling === !1 && u.prevIsScrolling === !0 && Object.assign(c, {
        isScrolling: !1
      });
      var h, v;
      return _i({
        cellCount: u.prevColumnCount,
        cellSize: typeof u.prevColumnWidth == "number" ? u.prevColumnWidth : null,
        computeMetadataCallback: function() {
          return u.columnSizeAndPositionManager.resetCell(0);
        },
        computeMetadataCallbackProps: e,
        nextCellsCount: e.columnCount,
        nextCellSize: typeof e.columnWidth == "number" ? e.columnWidth : null,
        nextScrollToIndex: e.scrollToColumn,
        scrollToIndex: u.prevScrollToColumn,
        updateScrollOffsetForScrollToIndex: function() {
          h = i._getScrollLeftForScrollToColumnStateUpdate(e, a);
        }
      }), _i({
        cellCount: u.prevRowCount,
        cellSize: typeof u.prevRowHeight == "number" ? u.prevRowHeight : null,
        computeMetadataCallback: function() {
          return u.rowSizeAndPositionManager.resetCell(0);
        },
        computeMetadataCallbackProps: e,
        nextCellsCount: e.rowCount,
        nextCellSize: typeof e.rowHeight == "number" ? e.rowHeight : null,
        nextScrollToIndex: e.scrollToRow,
        scrollToIndex: u.prevScrollToRow,
        updateScrollOffsetForScrollToIndex: function() {
          v = i._getScrollTopForScrollToRowStateUpdate(e, a);
        }
      }), u.prevColumnCount = e.columnCount, u.prevColumnWidth = e.columnWidth, u.prevIsScrolling = e.isScrolling === !0, u.prevRowCount = e.rowCount, u.prevRowHeight = e.rowHeight, u.prevScrollToColumn = e.scrollToColumn, u.prevScrollToRow = e.scrollToRow, u.scrollbarSize = e.getScrollbarSize(), u.scrollbarSize === void 0 ? (u.scrollbarSizeMeasured = !1, u.scrollbarSize = 0) : u.scrollbarSizeMeasured = !0, c.instanceProps = u, Ze(Ze(Ze({}, c), h), v);
    }
  }, {
    key: "_getEstimatedColumnSize",
    value: function(e) {
      return typeof e.columnWidth == "number" ? e.columnWidth : e.estimatedColumnSize;
    }
  }, {
    key: "_getEstimatedRowSize",
    value: function(e) {
      return typeof e.rowHeight == "number" ? e.rowHeight : e.estimatedRowSize;
    }
  }, {
    key: "_getScrollToPositionStateUpdate",
    value: (
      /**
       * Get the updated state after scrolling to
       * scrollLeft and scrollTop
       */
      function(e) {
        var a = e.prevState, c = e.scrollLeft, u = e.scrollTop, h = {
          scrollPositionChangeReason: Xn.REQUESTED
        };
        return typeof c == "number" && c >= 0 && (h.scrollDirectionHorizontal = c > a.scrollLeft ? vt : yn, h.scrollLeft = c), typeof u == "number" && u >= 0 && (h.scrollDirectionVertical = u > a.scrollTop ? vt : yn, h.scrollTop = u), typeof c == "number" && c >= 0 && c !== a.scrollLeft || typeof u == "number" && u >= 0 && u !== a.scrollTop ? h : {};
      }
    )
  }, {
    key: "_wrapSizeGetter",
    value: function(e) {
      return typeof e == "function" ? e : function() {
        return e;
      };
    }
  }, {
    key: "_getCalculatedScrollLeft",
    value: function(e, a) {
      var c = e.columnCount, u = e.height, h = e.scrollToAlignment, v = e.scrollToColumn, m = e.width, S = a.scrollLeft, b = a.instanceProps;
      if (c > 0) {
        var C = c - 1, R = v < 0 ? C : Math.min(C, v), z = b.rowSizeAndPositionManager.getTotalSize(), E = b.scrollbarSizeMeasured && z > u ? b.scrollbarSize : 0;
        return b.columnSizeAndPositionManager.getUpdatedOffsetForIndex({
          align: h,
          containerSize: m - E,
          currentOffset: S,
          targetIndex: R
        });
      }
      return 0;
    }
  }, {
    key: "_getScrollLeftForScrollToColumnStateUpdate",
    value: function(e, a) {
      var c = a.scrollLeft, u = i._getCalculatedScrollLeft(e, a);
      return typeof u == "number" && u >= 0 && c !== u ? i._getScrollToPositionStateUpdate({
        prevState: a,
        scrollLeft: u,
        scrollTop: -1
      }) : {};
    }
  }, {
    key: "_getCalculatedScrollTop",
    value: function(e, a) {
      var c = e.height, u = e.rowCount, h = e.scrollToAlignment, v = e.scrollToRow, m = e.width, S = a.scrollTop, b = a.instanceProps;
      if (u > 0) {
        var C = u - 1, R = v < 0 ? C : Math.min(C, v), z = b.columnSizeAndPositionManager.getTotalSize(), E = b.scrollbarSizeMeasured && z > m ? b.scrollbarSize : 0;
        return b.rowSizeAndPositionManager.getUpdatedOffsetForIndex({
          align: h,
          containerSize: c - E,
          currentOffset: S,
          targetIndex: R
        });
      }
      return 0;
    }
  }, {
    key: "_getScrollTopForScrollToRowStateUpdate",
    value: function(e, a) {
      var c = a.scrollTop, u = i._getCalculatedScrollTop(e, a);
      return typeof u == "number" && u >= 0 && c !== u ? i._getScrollToPositionStateUpdate({
        prevState: a,
        scrollLeft: -1,
        scrollTop: u
      }) : {};
    }
  }]);
})(le.PureComponent);
O(lt, "defaultProps", {
  "aria-label": "grid",
  "aria-readonly": !0,
  autoContainerWidth: !1,
  autoHeight: !1,
  autoWidth: !1,
  cellRangeRenderer: La,
  containerRole: "row",
  containerStyle: {},
  estimatedColumnSize: 100,
  estimatedRowSize: 30,
  getScrollbarSize: Jn,
  noContentRenderer: $a,
  onScroll: function() {
  },
  onScrollbarPresenceChange: function() {
  },
  onSectionRendered: function() {
  },
  overscanColumnCount: 0,
  overscanIndicesGetter: Da,
  overscanRowCount: 10,
  role: "grid",
  scrollingResetTimeInterval: Ha,
  scrollToAlignment: "auto",
  scrollToColumn: -1,
  scrollToRow: -1,
  style: {},
  tabIndex: 0,
  isScrollingOptOut: !1
});
nn(lt);
var Ua = 1;
function fo(s) {
  var i = s.cellCount, r = s.overscanCellsCount, e = s.scrollDirection, a = s.startIndex, c = s.stopIndex;
  return r = Math.max(1, r), e === Ua ? {
    overscanStartIndex: Math.max(0, a - 1),
    overscanStopIndex: Math.min(i - 1, c + r)
  } : {
    overscanStartIndex: Math.max(0, a - r),
    overscanStopIndex: Math.min(i - 1, c + 1)
  };
}
function er(s, i) {
  (i == null || i > s.length) && (i = s.length);
  for (var r = 0, e = Array(i); r < i; r++) e[r] = s[r];
  return e;
}
function Ba(s) {
  if (Array.isArray(s)) return er(s);
}
function qa(s) {
  if (typeof Symbol < "u" && s[Symbol.iterator] != null || s["@@iterator"] != null) return Array.from(s);
}
function ho(s, i) {
  if (s) {
    if (typeof s == "string") return er(s, i);
    var r = {}.toString.call(s).slice(8, -1);
    return r === "Object" && s.constructor && (r = s.constructor.name), r === "Map" || r === "Set" ? Array.from(s) : r === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(r) ? er(s, i) : void 0;
  }
}
function Va() {
  throw new TypeError(`Invalid attempt to spread non-iterable instance.
In order to be iterable, non-array objects must have a [Symbol.iterator]() method.`);
}
function Xa(s) {
  return Ba(s) || qa(s) || ho(s) || Va();
}
function Ya(s, i, r) {
  return i = ze(i), Xe(s, po() ? Reflect.construct(i, r || [], ze(s).constructor) : i.apply(s, r));
}
function po() {
  try {
    var s = !Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function() {
    }));
  } catch {
  }
  return (po = function() {
    return !!s;
  })();
}
var vo = /* @__PURE__ */ (function(s) {
  function i(r, e) {
    var a;
    return Ge(this, i), a = Ya(this, i, [r, e]), a._loadMoreRowsMemoizer = Gt(), a._onRowsRendered = a._onRowsRendered.bind(a), a._registerChild = a._registerChild.bind(a), a;
  }
  return Ye(i, s), We(i, [{
    key: "resetLoadMoreRowsCache",
    value: function(e) {
      this._loadMoreRowsMemoizer = Gt(), e && this._doStuff(this._lastRenderedStartIndex, this._lastRenderedStopIndex);
    }
  }, {
    key: "render",
    value: function() {
      var e = this.props.children;
      return e({
        onRowsRendered: this._onRowsRendered,
        registerChild: this._registerChild
      });
    }
  }, {
    key: "_loadUnloadedRanges",
    value: function(e) {
      var a = this, c = this.props.loadMoreRows;
      e.forEach(function(u) {
        var h = c(u);
        h && h.then(function() {
          Ka({
            lastRenderedStartIndex: a._lastRenderedStartIndex,
            lastRenderedStopIndex: a._lastRenderedStopIndex,
            startIndex: u.startIndex,
            stopIndex: u.stopIndex
          }) && a._registeredChild && Qa(a._registeredChild, a._lastRenderedStartIndex);
        });
      });
    }
  }, {
    key: "_onRowsRendered",
    value: function(e) {
      var a = e.startIndex, c = e.stopIndex;
      this._lastRenderedStartIndex = a, this._lastRenderedStopIndex = c, this._doStuff(a, c);
    }
  }, {
    key: "_doStuff",
    value: function(e, a) {
      var c, u = this, h = this.props, v = h.isRowLoaded, m = h.minimumBatchSize, S = h.rowCount, b = h.threshold, C = Za({
        isRowLoaded: v,
        minimumBatchSize: m,
        rowCount: S,
        startIndex: Math.max(0, e - b),
        stopIndex: Math.min(S - 1, a + b)
      }), R = (c = []).concat.apply(c, Xa(C.map(function(z) {
        var E = z.startIndex, k = z.stopIndex;
        return [E, k];
      })));
      this._loadMoreRowsMemoizer({
        callback: function() {
          u._loadUnloadedRanges(C);
        },
        indices: {
          squashedUnloadedRanges: R
        }
      });
    }
  }, {
    key: "_registerChild",
    value: function(e) {
      this._registeredChild = e;
    }
  }]);
})(le.PureComponent);
O(vo, "defaultProps", {
  minimumBatchSize: 10,
  rowCount: 0,
  threshold: 15
});
vo.propTypes = process.env.NODE_ENV !== "production" ? {
  /**
   * Function responsible for rendering a virtualized component.
   * This function should implement the following signature:
   * ({ onRowsRendered, registerChild }) => PropTypes.element
   *
   * The specified :onRowsRendered function should be passed through to the child's :onRowsRendered property.
   * The :registerChild callback should be set as the virtualized component's :ref.
   */
  children: D.func.isRequired,
  /**
   * Function responsible for tracking the loaded state of each row.
   * It should implement the following signature: ({ index: number }): boolean
   */
  isRowLoaded: D.func.isRequired,
  /**
   * Callback to be invoked when more rows must be loaded.
   * It should implement the following signature: ({ startIndex, stopIndex }): Promise
   * The returned Promise should be resolved once row data has finished loading.
   * It will be used to determine when to refresh the list with the newly-loaded data.
   * This callback may be called multiple times in reaction to a single scroll event.
   */
  loadMoreRows: D.func.isRequired,
  /**
   * Minimum number of rows to be loaded at a time.
   * This property can be used to batch requests to reduce HTTP requests.
   */
  minimumBatchSize: D.number.isRequired,
  /**
   * Number of rows in list; can be arbitrary high number if actual number is unknown.
   */
  rowCount: D.number.isRequired,
  /**
   * Threshold at which to pre-fetch data.
   * A threshold X means that data will start loading when a user scrolls within X rows.
   * This value defaults to 15.
   */
  threshold: D.number.isRequired
} : {};
function Ka(s) {
  var i = s.lastRenderedStartIndex, r = s.lastRenderedStopIndex, e = s.startIndex, a = s.stopIndex;
  return !(e > r || a < i);
}
function Za(s) {
  for (var i = s.isRowLoaded, r = s.minimumBatchSize, e = s.rowCount, a = s.startIndex, c = s.stopIndex, u = [], h = null, v = null, m = a; m <= c; m++) {
    var S = i({
      index: m
    });
    S ? v !== null && (u.push({
      startIndex: h,
      stopIndex: v
    }), h = v = null) : (v = m, h === null && (h = m));
  }
  if (v !== null) {
    for (var b = Math.min(Math.max(v, h + r - 1), e - 1), C = v + 1; C <= b && !i({
      index: C
    }); C++)
      v = C;
    u.push({
      startIndex: h,
      stopIndex: v
    });
  }
  if (u.length)
    for (var R = u[0]; R.stopIndex - R.startIndex + 1 < r && R.startIndex > 0; ) {
      var z = R.startIndex - 1;
      if (!i({
        index: z
      }))
        R.startIndex = z;
      else
        break;
    }
  return u;
}
function Qa(s) {
  var i = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : 0, r = typeof s.recomputeGridSize == "function" ? s.recomputeGridSize : s.recomputeRowHeights;
  r ? r.call(s, i) : s.forceUpdate();
}
function Ja(s, i, r) {
  return i = ze(i), Xe(s, go() ? Reflect.construct(i, r || [], ze(s).constructor) : i.apply(s, r));
}
function go() {
  try {
    var s = !Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function() {
    }));
  } catch {
  }
  return (go = function() {
    return !!s;
  })();
}
var el = /* @__PURE__ */ (function(s) {
  function i() {
    var r;
    Ge(this, i);
    for (var e = arguments.length, a = new Array(e), c = 0; c < e; c++)
      a[c] = arguments[c];
    return r = Ja(this, i, [].concat(a)), O(r, "Grid", void 0), O(r, "_cellRenderer", function(u) {
      var h = u.parent, v = u.rowIndex, m = u.style, S = u.isScrolling, b = u.isVisible, C = u.key, R = r.props.rowRenderer, z = Object.getOwnPropertyDescriptor(m, "width");
      return z && z.writable && (m.width = "100%"), R({
        index: v,
        style: m,
        isScrolling: S,
        isVisible: b,
        key: C,
        parent: h
      });
    }), O(r, "_setRef", function(u) {
      r.Grid = u;
    }), O(r, "_onScroll", function(u) {
      var h = u.clientHeight, v = u.scrollHeight, m = u.scrollTop, S = r.props.onScroll;
      S({
        clientHeight: h,
        scrollHeight: v,
        scrollTop: m
      });
    }), O(r, "_onSectionRendered", function(u) {
      var h = u.rowOverscanStartIndex, v = u.rowOverscanStopIndex, m = u.rowStartIndex, S = u.rowStopIndex, b = r.props.onRowsRendered;
      b({
        overscanStartIndex: h,
        overscanStopIndex: v,
        startIndex: m,
        stopIndex: S
      });
    }), r;
  }
  return Ye(i, s), We(i, [{
    key: "forceUpdateGrid",
    value: function() {
      this.Grid && this.Grid.forceUpdate();
    }
    /** See Grid#getOffsetForCell */
  }, {
    key: "getOffsetForRow",
    value: function(e) {
      var a = e.alignment, c = e.index;
      if (this.Grid) {
        var u = this.Grid.getOffsetForCell({
          alignment: a,
          rowIndex: c,
          columnIndex: 0
        }), h = u.scrollTop;
        return h;
      }
      return 0;
    }
    /** CellMeasurer compatibility */
  }, {
    key: "invalidateCellSizeAfterRender",
    value: function(e) {
      var a = e.columnIndex, c = e.rowIndex;
      this.Grid && this.Grid.invalidateCellSizeAfterRender({
        rowIndex: c,
        columnIndex: a
      });
    }
    /** See Grid#measureAllCells */
  }, {
    key: "measureAllRows",
    value: function() {
      this.Grid && this.Grid.measureAllCells();
    }
    /** CellMeasurer compatibility */
  }, {
    key: "recomputeGridSize",
    value: function() {
      var e = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : {}, a = e.columnIndex, c = a === void 0 ? 0 : a, u = e.rowIndex, h = u === void 0 ? 0 : u;
      this.Grid && this.Grid.recomputeGridSize({
        rowIndex: h,
        columnIndex: c
      });
    }
    /** See Grid#recomputeGridSize */
  }, {
    key: "recomputeRowHeights",
    value: function() {
      var e = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : 0;
      this.Grid && this.Grid.recomputeGridSize({
        rowIndex: e,
        columnIndex: 0
      });
    }
    /** See Grid#scrollToPosition */
  }, {
    key: "scrollToPosition",
    value: function() {
      var e = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : 0;
      this.Grid && this.Grid.scrollToPosition({
        scrollTop: e
      });
    }
    /** See Grid#scrollToCell */
  }, {
    key: "scrollToRow",
    value: function() {
      var e = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : 0;
      this.Grid && this.Grid.scrollToCell({
        columnIndex: 0,
        rowIndex: e
      });
    }
  }, {
    key: "render",
    value: function() {
      var e = this.props, a = e.className, c = e.noRowsRenderer, u = e.scrollToIndex, h = e.width, v = rt("ReactVirtualized__List", a);
      return /* @__PURE__ */ le.createElement(lt, tt({}, this.props, {
        autoContainerWidth: !0,
        cellRenderer: this._cellRenderer,
        className: v,
        columnWidth: h,
        columnCount: 1,
        noContentRenderer: c,
        onScroll: this._onScroll,
        onSectionRendered: this._onSectionRendered,
        ref: this._setRef,
        scrollToRow: u
      }));
    }
  }]);
})(le.PureComponent);
O(el, "defaultProps", {
  autoHeight: !1,
  estimatedRowSize: 30,
  onScroll: function() {
  },
  noRowsRenderer: function() {
    return null;
  },
  onRowsRendered: function() {
  },
  overscanIndicesGetter: fo,
  overscanRowCount: 10,
  scrollToAlignment: "auto",
  scrollToIndex: -1,
  style: {}
});
function tl(s) {
  if (Array.isArray(s)) return s;
}
function nl(s, i) {
  var r = s == null ? null : typeof Symbol < "u" && s[Symbol.iterator] || s["@@iterator"];
  if (r != null) {
    var e, a, c, u, h = [], v = !0, m = !1;
    try {
      if (c = (r = r.call(s)).next, i !== 0) for (; !(v = (e = c.call(r)).done) && (h.push(e.value), h.length !== i); v = !0) ;
    } catch (S) {
      m = !0, a = S;
    } finally {
      try {
        if (!v && r.return != null && (u = r.return(), Object(u) !== u)) return;
      } finally {
        if (m) throw a;
      }
    }
    return h;
  }
}
function rl() {
  throw new TypeError(`Invalid attempt to destructure non-iterable instance.
In order to be iterable, non-array objects must have a [Symbol.iterator]() method.`);
}
function il(s, i) {
  return tl(s) || nl(s, i) || ho(s, i) || rl();
}
function ol(s, i, r, e) {
  for (var a = r + 1; i <= r; ) {
    var c = i + r >>> 1, u = s[c];
    u >= e ? (a = c, r = c - 1) : i = c + 1;
  }
  return a;
}
function sl(s, i, r, e, a) {
  for (var c = r + 1; i <= r; ) {
    var u = i + r >>> 1, h = s[u];
    a(h, e) >= 0 ? (c = u, r = u - 1) : i = u + 1;
  }
  return c;
}
function al(s, i, r, e, a) {
  return typeof r == "function" ? sl(s, e === void 0 ? 0 : e | 0, a === void 0 ? s.length - 1 : a | 0, i, r) : ol(s, r === void 0 ? 0 : r | 0, e === void 0 ? s.length - 1 : e | 0, i);
}
function ll(s, i, r, e) {
  for (var a = r + 1; i <= r; ) {
    var c = i + r >>> 1, u = s[c];
    u > e ? (a = c, r = c - 1) : i = c + 1;
  }
  return a;
}
function cl(s, i, r, e, a) {
  for (var c = r + 1; i <= r; ) {
    var u = i + r >>> 1, h = s[u];
    a(h, e) > 0 ? (c = u, r = u - 1) : i = u + 1;
  }
  return c;
}
function ul(s, i, r, e, a) {
  return typeof r == "function" ? cl(s, e === void 0 ? 0 : e | 0, a === void 0 ? s.length - 1 : a | 0, i, r) : ll(s, r === void 0 ? 0 : r | 0, e === void 0 ? s.length - 1 : e | 0, i);
}
function dl(s, i, r, e) {
  for (var a = i - 1; i <= r; ) {
    var c = i + r >>> 1, u = s[c];
    u < e ? (a = c, i = c + 1) : r = c - 1;
  }
  return a;
}
function fl(s, i, r, e, a) {
  for (var c = i - 1; i <= r; ) {
    var u = i + r >>> 1, h = s[u];
    a(h, e) < 0 ? (c = u, i = u + 1) : r = u - 1;
  }
  return c;
}
function hl(s, i, r, e, a) {
  return typeof r == "function" ? fl(s, e === void 0 ? 0 : e | 0, a === void 0 ? s.length - 1 : a | 0, i, r) : dl(s, r === void 0 ? 0 : r | 0, e === void 0 ? s.length - 1 : e | 0, i);
}
function pl(s, i, r, e) {
  for (var a = i - 1; i <= r; ) {
    var c = i + r >>> 1, u = s[c];
    u <= e ? (a = c, i = c + 1) : r = c - 1;
  }
  return a;
}
function vl(s, i, r, e, a) {
  for (var c = i - 1; i <= r; ) {
    var u = i + r >>> 1, h = s[u];
    a(h, e) <= 0 ? (c = u, i = u + 1) : r = u - 1;
  }
  return c;
}
function gl(s, i, r, e, a) {
  return typeof r == "function" ? vl(s, e === void 0 ? 0 : e | 0, a === void 0 ? s.length - 1 : a | 0, i, r) : pl(s, r === void 0 ? 0 : r | 0, e === void 0 ? s.length - 1 : e | 0, i);
}
function ml(s, i, r, e) {
  for (; i <= r; ) {
    var a = i + r >>> 1, c = s[a];
    if (c === e)
      return a;
    c <= e ? i = a + 1 : r = a - 1;
  }
  return -1;
}
function yl(s, i, r, e, a) {
  for (; i <= r; ) {
    var c = i + r >>> 1, u = s[c], h = a(u, e);
    if (h === 0)
      return c;
    h <= 0 ? i = c + 1 : r = c - 1;
  }
  return -1;
}
function Sl(s, i, r, e, a) {
  return typeof r == "function" ? yl(s, e === void 0 ? 0 : e | 0, a === void 0 ? s.length - 1 : a | 0, i, r) : ml(s, r === void 0 ? 0 : r | 0, e === void 0 ? s.length - 1 : e | 0, i);
}
const bn = {
  ge: al,
  gt: ul,
  lt: hl,
  le: gl,
  eq: Sl
};
var Lt = 0, It = 1, _n = 2;
function fr(s, i, r, e, a) {
  this.mid = s, this.left = i, this.right = r, this.leftPoints = e, this.rightPoints = a, this.count = (i ? i.count : 0) + (r ? r.count : 0) + e.length;
}
var rn = fr.prototype;
function Yn(s, i) {
  s.mid = i.mid, s.left = i.left, s.right = i.right, s.leftPoints = i.leftPoints, s.rightPoints = i.rightPoints, s.count = i.count;
}
function mo(s, i) {
  var r = en(i);
  s.mid = r.mid, s.left = r.left, s.right = r.right, s.leftPoints = r.leftPoints, s.rightPoints = r.rightPoints, s.count = r.count;
}
function Ri(s, i) {
  var r = s.intervals([]);
  r.push(i), mo(s, r);
}
function Ti(s, i) {
  var r = s.intervals([]), e = r.indexOf(i);
  return e < 0 ? Lt : (r.splice(e, 1), mo(s, r), It);
}
rn.intervals = function(s) {
  return s.push.apply(s, this.leftPoints), this.left && this.left.intervals(s), this.right && this.right.intervals(s), s;
};
rn.insert = function(s) {
  var i = this.count - this.leftPoints.length;
  if (this.count += 1, s[1] < this.mid)
    this.left ? 4 * (this.left.count + 1) > 3 * (i + 1) ? Ri(this, s) : this.left.insert(s) : this.left = en([s]);
  else if (s[0] > this.mid)
    this.right ? 4 * (this.right.count + 1) > 3 * (i + 1) ? Ri(this, s) : this.right.insert(s) : this.right = en([s]);
  else {
    var r = bn.ge(this.leftPoints, s, hr), e = bn.ge(this.rightPoints, s, pr);
    this.leftPoints.splice(r, 0, s), this.rightPoints.splice(e, 0, s);
  }
};
rn.remove = function(s) {
  var i = this.count - this.leftPoints;
  if (s[1] < this.mid) {
    if (!this.left)
      return Lt;
    var r = this.right ? this.right.count : 0;
    if (4 * r > 3 * (i - 1))
      return Ti(this, s);
    var e = this.left.remove(s);
    return e === _n ? (this.left = null, this.count -= 1, It) : (e === It && (this.count -= 1), e);
  } else if (s[0] > this.mid) {
    if (!this.right)
      return Lt;
    var a = this.left ? this.left.count : 0;
    if (4 * a > 3 * (i - 1))
      return Ti(this, s);
    var e = this.right.remove(s);
    return e === _n ? (this.right = null, this.count -= 1, It) : (e === It && (this.count -= 1), e);
  } else {
    if (this.count === 1)
      return this.leftPoints[0] === s ? _n : Lt;
    if (this.leftPoints.length === 1 && this.leftPoints[0] === s) {
      if (this.left && this.right) {
        for (var c = this, u = this.left; u.right; )
          c = u, u = u.right;
        if (c === this)
          u.right = this.right;
        else {
          var h = this.left, e = this.right;
          c.count -= u.count, c.right = u.left, u.left = h, u.right = e;
        }
        Yn(this, u), this.count = (this.left ? this.left.count : 0) + (this.right ? this.right.count : 0) + this.leftPoints.length;
      } else this.left ? Yn(this, this.left) : Yn(this, this.right);
      return It;
    }
    for (var h = bn.ge(this.leftPoints, s, hr); h < this.leftPoints.length && this.leftPoints[h][0] === s[0]; ++h)
      if (this.leftPoints[h] === s) {
        this.count -= 1, this.leftPoints.splice(h, 1);
        for (var e = bn.ge(this.rightPoints, s, pr); e < this.rightPoints.length && this.rightPoints[e][1] === s[1]; ++e)
          if (this.rightPoints[e] === s)
            return this.rightPoints.splice(e, 1), It;
      }
    return Lt;
  }
};
function yo(s, i, r) {
  for (var e = 0; e < s.length && s[e][0] <= i; ++e) {
    var a = r(s[e]);
    if (a)
      return a;
  }
}
function So(s, i, r) {
  for (var e = s.length - 1; e >= 0 && s[e][1] >= i; --e) {
    var a = r(s[e]);
    if (a)
      return a;
  }
}
function _o(s, i) {
  for (var r = 0; r < s.length; ++r) {
    var e = i(s[r]);
    if (e)
      return e;
  }
}
rn.queryPoint = function(s, i) {
  if (s < this.mid) {
    if (this.left) {
      var r = this.left.queryPoint(s, i);
      if (r)
        return r;
    }
    return yo(this.leftPoints, s, i);
  } else if (s > this.mid) {
    if (this.right) {
      var r = this.right.queryPoint(s, i);
      if (r)
        return r;
    }
    return So(this.rightPoints, s, i);
  } else
    return _o(this.leftPoints, i);
};
rn.queryInterval = function(s, i, r) {
  if (s < this.mid && this.left) {
    var e = this.left.queryInterval(s, i, r);
    if (e)
      return e;
  }
  if (i > this.mid && this.right) {
    var e = this.right.queryInterval(s, i, r);
    if (e)
      return e;
  }
  return i < this.mid ? yo(this.leftPoints, i, r) : s > this.mid ? So(this.rightPoints, s, r) : _o(this.leftPoints, r);
};
function _l(s, i) {
  return s - i;
}
function hr(s, i) {
  var r = s[0] - i[0];
  return r || s[1] - i[1];
}
function pr(s, i) {
  var r = s[1] - i[1];
  return r || s[0] - i[0];
}
function en(s) {
  if (s.length === 0)
    return null;
  for (var i = [], r = 0; r < s.length; ++r)
    i.push(s[r][0], s[r][1]);
  i.sort(_l);
  for (var e = i[i.length >> 1], a = [], c = [], u = [], r = 0; r < s.length; ++r) {
    var h = s[r];
    h[1] < e ? a.push(h) : e < h[0] ? c.push(h) : u.push(h);
  }
  var v = u, m = u.slice();
  return v.sort(hr), m.sort(pr), new fr(e, en(a), en(c), v, m);
}
function bo(s) {
  this.root = s;
}
var jt = bo.prototype;
jt.insert = function(s) {
  this.root ? this.root.insert(s) : this.root = new fr(s[0], null, null, [s], [s]);
};
jt.remove = function(s) {
  if (this.root) {
    var i = this.root.remove(s);
    return i === _n && (this.root = null), i !== Lt;
  }
  return !1;
};
jt.queryPoint = function(s, i) {
  if (this.root)
    return this.root.queryPoint(s, i);
};
jt.queryInterval = function(s, i, r) {
  if (s <= i && this.root)
    return this.root.queryInterval(s, i, r);
};
Object.defineProperty(jt, "count", {
  get: function() {
    return this.root ? this.root.count : 0;
  }
});
Object.defineProperty(jt, "intervals", {
  get: function() {
    return this.root ? this.root.intervals([]) : [];
  }
});
function bl(s) {
  return new bo(null);
}
var Kn = /* @__PURE__ */ (function() {
  function s() {
    Ge(this, s), O(this, "_columnSizeMap", {}), O(this, "_intervalTree", bl()), O(this, "_leftMap", {});
  }
  return We(s, [{
    key: "estimateTotalHeight",
    value: function(r, e, a) {
      var c = r - this.count;
      return this.tallestColumnSize + Math.ceil(c / e) * a;
    }
    // Render all cells visible within the viewport range defined.
  }, {
    key: "range",
    value: function(r, e, a) {
      var c = this;
      this._intervalTree.queryInterval(r, r + e, function(u) {
        var h = il(u, 3), v = h[0];
        h[1];
        var m = h[2];
        return a(m, c._leftMap[m], v);
      });
    }
  }, {
    key: "setPosition",
    value: function(r, e, a, c) {
      this._intervalTree.insert([a, a + c, r]), this._leftMap[r] = e;
      var u = this._columnSizeMap, h = u[e];
      h === void 0 ? u[e] = a + c : u[e] = Math.max(h, a + c);
    }
  }, {
    key: "count",
    get: function() {
      return this._intervalTree.count;
    }
  }, {
    key: "shortestColumnSize",
    get: function() {
      var r = this._columnSizeMap, e = 0;
      for (var a in r) {
        var c = r[a];
        e = e === 0 ? c : Math.min(e, c);
      }
      return e;
    }
  }, {
    key: "tallestColumnSize",
    get: function() {
      var r = this._columnSizeMap, e = 0;
      for (var a in r) {
        var c = r[a];
        e = Math.max(e, c);
      }
      return e;
    }
  }]);
})();
function Ii(s, i) {
  var r = Object.keys(s);
  if (Object.getOwnPropertySymbols) {
    var e = Object.getOwnPropertySymbols(s);
    i && (e = e.filter(function(a) {
      return Object.getOwnPropertyDescriptor(s, a).enumerable;
    })), r.push.apply(r, e);
  }
  return r;
}
function wl(s) {
  for (var i = 1; i < arguments.length; i++) {
    var r = arguments[i] != null ? arguments[i] : {};
    i % 2 ? Ii(Object(r), !0).forEach(function(e) {
      O(s, e, r[e]);
    }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(s, Object.getOwnPropertyDescriptors(r)) : Ii(Object(r)).forEach(function(e) {
      Object.defineProperty(s, e, Object.getOwnPropertyDescriptor(r, e));
    });
  }
  return s;
}
function Cl(s, i, r) {
  return i = ze(i), Xe(s, wo() ? Reflect.construct(i, r || [], ze(s).constructor) : i.apply(s, r));
}
function wo() {
  try {
    var s = !Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function() {
    }));
  } catch {
  }
  return (wo = function() {
    return !!s;
  })();
}
var xl = {}, Rl = 150, Co = /* @__PURE__ */ (function(s) {
  function i() {
    var r;
    Ge(this, i);
    for (var e = arguments.length, a = new Array(e), c = 0; c < e; c++)
      a[c] = arguments[c];
    return r = Cl(this, i, [].concat(a)), O(r, "state", {
      isScrolling: !1,
      scrollTop: 0
    }), O(r, "_debounceResetIsScrollingId", void 0), O(r, "_invalidateOnUpdateStartIndex", null), O(r, "_invalidateOnUpdateStopIndex", null), O(r, "_positionCache", new Kn()), O(r, "_startIndex", null), O(r, "_startIndexMemoized", null), O(r, "_stopIndex", null), O(r, "_stopIndexMemoized", null), O(r, "_debounceResetIsScrollingCallback", function() {
      r.setState({
        isScrolling: !1
      });
    }), O(r, "_setScrollingContainerRef", function(u) {
      r._scrollingContainer = u;
    }), O(r, "_onScroll", function(u) {
      var h = r.props.height, v = u.currentTarget.scrollTop, m = Math.min(Math.max(0, r._getEstimatedTotalHeight() - h), v);
      v === m && (r._debounceResetIsScrolling(), r.state.scrollTop !== m && r.setState({
        isScrolling: !0,
        scrollTop: m
      }));
    }), r;
  }
  return Ye(i, s), We(i, [{
    key: "clearCellPositions",
    value: function() {
      this._positionCache = new Kn(), this.forceUpdate();
    }
    // HACK This method signature was intended for Grid
  }, {
    key: "invalidateCellSizeAfterRender",
    value: function(e) {
      var a = e.rowIndex;
      this._invalidateOnUpdateStartIndex === null ? (this._invalidateOnUpdateStartIndex = a, this._invalidateOnUpdateStopIndex = a) : (this._invalidateOnUpdateStartIndex = Math.min(this._invalidateOnUpdateStartIndex, a), this._invalidateOnUpdateStopIndex = Math.max(this._invalidateOnUpdateStopIndex, a));
    }
  }, {
    key: "recomputeCellPositions",
    value: function() {
      var e = this._positionCache.count - 1;
      this._positionCache = new Kn(), this._populatePositionCache(0, e), this.forceUpdate();
    }
  }, {
    key: "componentDidMount",
    value: function() {
      this._checkInvalidateOnUpdate(), this._invokeOnScrollCallback(), this._invokeOnCellsRenderedCallback();
    }
  }, {
    key: "componentDidUpdate",
    value: function(e, a) {
      this._checkInvalidateOnUpdate(), this._invokeOnScrollCallback(), this._invokeOnCellsRenderedCallback(), this.props.scrollTop !== e.scrollTop && this._debounceResetIsScrolling();
    }
  }, {
    key: "componentWillUnmount",
    value: function() {
      this._debounceResetIsScrollingId && Wt(this._debounceResetIsScrollingId);
    }
  }, {
    key: "render",
    value: function() {
      var e = this, a = this.props, c = a.autoHeight, u = a.cellCount, h = a.cellMeasurerCache, v = a.cellRenderer, m = a.className, S = a.height, b = a.id, C = a.keyMapper, R = a.overscanByPixels, z = a.role, E = a.style, k = a.tabIndex, L = a.width, q = a.rowDirection, P = this.state, W = P.isScrolling, I = P.scrollTop, V = [], x = this._getEstimatedTotalHeight(), j = this._positionCache.shortestColumnSize, ie = this._positionCache.count, te = 0, Q;
      if (this._positionCache.range(Math.max(0, I - R), S + R * 2, function(he, pe, Se) {
        typeof Q > "u" ? (te = he, Q = he) : (te = Math.min(te, he), Q = Math.max(Q, he)), V.push(v({
          index: he,
          isScrolling: W,
          key: C(he),
          parent: e,
          style: O(O(O(O({
            height: h.getHeight(he)
          }, q === "ltr" ? "left" : "right", pe), "position", "absolute"), "top", Se), "width", h.getWidth(he))
        }));
      }), j < I + S + R && ie < u)
        for (var ce = Math.min(u - ie, Math.ceil((I + S + R - j) / h.defaultHeight * L / h.defaultWidth)), de = ie; de < ie + ce; de++)
          Q = de, V.push(v({
            index: de,
            isScrolling: W,
            key: C(de),
            parent: this,
            style: {
              width: h.getWidth(de)
            }
          }));
      return this._startIndex = te, this._stopIndex = Q, /* @__PURE__ */ le.createElement("div", {
        ref: this._setScrollingContainerRef,
        "aria-label": this.props["aria-label"],
        className: rt("ReactVirtualized__Masonry", m),
        id: b,
        onScroll: this._onScroll,
        role: z,
        style: wl({
          boxSizing: "border-box",
          direction: "ltr",
          height: c ? "auto" : S,
          overflowX: "hidden",
          overflowY: x < S ? "hidden" : "auto",
          position: "relative",
          width: L,
          WebkitOverflowScrolling: "touch",
          willChange: "transform"
        }, E),
        tabIndex: k
      }, /* @__PURE__ */ le.createElement("div", {
        className: "ReactVirtualized__Masonry__innerScrollContainer",
        style: {
          width: "100%",
          height: x,
          maxWidth: "100%",
          maxHeight: x,
          overflow: "hidden",
          pointerEvents: W ? "none" : "",
          position: "relative"
        }
      }, V));
    }
  }, {
    key: "_checkInvalidateOnUpdate",
    value: function() {
      if (typeof this._invalidateOnUpdateStartIndex == "number") {
        var e = this._invalidateOnUpdateStartIndex, a = this._invalidateOnUpdateStopIndex;
        this._invalidateOnUpdateStartIndex = null, this._invalidateOnUpdateStopIndex = null, this._populatePositionCache(e, a), this.forceUpdate();
      }
    }
  }, {
    key: "_debounceResetIsScrolling",
    value: function() {
      var e = this.props.scrollingResetTimeInterval;
      this._debounceResetIsScrollingId && Wt(this._debounceResetIsScrollingId), this._debounceResetIsScrollingId = dr(this._debounceResetIsScrollingCallback, e);
    }
  }, {
    key: "_getEstimatedTotalHeight",
    value: function() {
      var e = this.props, a = e.cellCount, c = e.cellMeasurerCache, u = e.width, h = Math.max(1, Math.floor(u / c.defaultWidth));
      return this._positionCache.estimateTotalHeight(a, h, c.defaultHeight);
    }
  }, {
    key: "_invokeOnScrollCallback",
    value: function() {
      var e = this.props, a = e.height, c = e.onScroll, u = this.state.scrollTop;
      this._onScrollMemoized !== u && (c({
        clientHeight: a,
        scrollHeight: this._getEstimatedTotalHeight(),
        scrollTop: u
      }), this._onScrollMemoized = u);
    }
  }, {
    key: "_invokeOnCellsRenderedCallback",
    value: function() {
      if (this._startIndexMemoized !== this._startIndex || this._stopIndexMemoized !== this._stopIndex) {
        var e = this.props.onCellsRendered;
        e({
          startIndex: this._startIndex,
          stopIndex: this._stopIndex
        }), this._startIndexMemoized = this._startIndex, this._stopIndexMemoized = this._stopIndex;
      }
    }
  }, {
    key: "_populatePositionCache",
    value: function(e, a) {
      for (var c = this.props, u = c.cellMeasurerCache, h = c.cellPositioner, v = e; v <= a; v++) {
        var m = h(v), S = m.left, b = m.top;
        this._positionCache.setPosition(v, S, b, u.getHeight(v));
      }
    }
  }], [{
    key: "getDerivedStateFromProps",
    value: function(e, a) {
      return e.scrollTop !== void 0 && a.scrollTop !== e.scrollTop ? {
        isScrolling: !0,
        scrollTop: e.scrollTop
      } : null;
    }
  }]);
})(le.PureComponent);
O(Co, "defaultProps", {
  autoHeight: !1,
  keyMapper: Tl,
  onCellsRendered: zi,
  onScroll: zi,
  overscanByPixels: 20,
  role: "grid",
  scrollingResetTimeInterval: Rl,
  style: xl,
  tabIndex: 0,
  rowDirection: "ltr"
});
function Tl(s) {
  return s;
}
function zi() {
}
nn(Co);
var Zn = /* @__PURE__ */ (function() {
  function s() {
    var i = this, r = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : {};
    Ge(this, s), O(this, "_cellMeasurerCache", void 0), O(this, "_columnIndexOffset", void 0), O(this, "_rowIndexOffset", void 0), O(this, "columnWidth", function(v) {
      var m = v.index;
      i._cellMeasurerCache.columnWidth({
        index: m + i._columnIndexOffset
      });
    }), O(this, "rowHeight", function(v) {
      var m = v.index;
      i._cellMeasurerCache.rowHeight({
        index: m + i._rowIndexOffset
      });
    });
    var e = r.cellMeasurerCache, a = r.columnIndexOffset, c = a === void 0 ? 0 : a, u = r.rowIndexOffset, h = u === void 0 ? 0 : u;
    this._cellMeasurerCache = e, this._columnIndexOffset = c, this._rowIndexOffset = h;
  }
  return We(s, [{
    key: "clear",
    value: function(r, e) {
      this._cellMeasurerCache.clear(r + this._rowIndexOffset, e + this._columnIndexOffset);
    }
  }, {
    key: "clearAll",
    value: function() {
      this._cellMeasurerCache.clearAll();
    }
  }, {
    key: "defaultHeight",
    get: function() {
      return this._cellMeasurerCache.defaultHeight;
    }
  }, {
    key: "defaultWidth",
    get: function() {
      return this._cellMeasurerCache.defaultWidth;
    }
  }, {
    key: "hasFixedHeight",
    value: function() {
      return this._cellMeasurerCache.hasFixedHeight();
    }
  }, {
    key: "hasFixedWidth",
    value: function() {
      return this._cellMeasurerCache.hasFixedWidth();
    }
  }, {
    key: "getHeight",
    value: function(r) {
      var e = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : 0;
      return this._cellMeasurerCache.getHeight(r + this._rowIndexOffset, e + this._columnIndexOffset);
    }
  }, {
    key: "getWidth",
    value: function(r) {
      var e = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : 0;
      return this._cellMeasurerCache.getWidth(r + this._rowIndexOffset, e + this._columnIndexOffset);
    }
  }, {
    key: "has",
    value: function(r) {
      var e = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : 0;
      return this._cellMeasurerCache.has(r + this._rowIndexOffset, e + this._columnIndexOffset);
    }
  }, {
    key: "set",
    value: function(r, e, a, c) {
      this._cellMeasurerCache.set(r + this._rowIndexOffset, e + this._columnIndexOffset, a, c);
    }
  }]);
})(), Il = ["rowIndex"], zl = ["columnIndex", "rowIndex"], El = ["columnIndex"], Ol = ["onScroll", "onSectionRendered", "onScrollbarPresenceChange", "scrollLeft", "scrollToColumn", "scrollTop", "scrollToRow"];
function Ei(s, i) {
  var r = Object.keys(s);
  if (Object.getOwnPropertySymbols) {
    var e = Object.getOwnPropertySymbols(s);
    i && (e = e.filter(function(a) {
      return Object.getOwnPropertyDescriptor(s, a).enumerable;
    })), r.push.apply(r, e);
  }
  return r;
}
function Me(s) {
  for (var i = 1; i < arguments.length; i++) {
    var r = arguments[i] != null ? arguments[i] : {};
    i % 2 ? Ei(Object(r), !0).forEach(function(e) {
      O(s, e, r[e]);
    }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(s, Object.getOwnPropertyDescriptors(r)) : Ei(Object(r)).forEach(function(e) {
      Object.defineProperty(s, e, Object.getOwnPropertyDescriptor(r, e));
    });
  }
  return s;
}
function Pl(s, i, r) {
  return i = ze(i), Xe(s, xo() ? Reflect.construct(i, r || [], ze(s).constructor) : i.apply(s, r));
}
function xo() {
  try {
    var s = !Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function() {
    }));
  } catch {
  }
  return (xo = function() {
    return !!s;
  })();
}
var Oi = 20, vr = /* @__PURE__ */ (function(s) {
  function i(r, e) {
    var a;
    Ge(this, i), a = Pl(this, i, [r, e]), O(a, "state", {
      scrollLeft: 0,
      scrollTop: 0,
      scrollbarSize: 0,
      showHorizontalScrollbar: !1,
      showVerticalScrollbar: !1
    }), O(a, "_deferredInvalidateColumnIndex", null), O(a, "_deferredInvalidateRowIndex", null), O(a, "_bottomLeftGridRef", function(v) {
      a._bottomLeftGrid = v;
    }), O(a, "_bottomRightGridRef", function(v) {
      a._bottomRightGrid = v;
    }), O(a, "_cellRendererBottomLeftGrid", function(v) {
      var m = v.rowIndex, S = Yt(v, Il), b = a.props, C = b.cellRenderer, R = b.fixedRowCount, z = b.rowCount;
      return m === z - R ? /* @__PURE__ */ le.createElement("div", {
        key: S.key,
        style: Me(Me({}, S.style), {}, {
          height: Oi
        })
      }) : C(Me(Me({}, S), {}, {
        parent: a,
        rowIndex: m + R
      }));
    }), O(a, "_cellRendererBottomRightGrid", function(v) {
      var m = v.columnIndex, S = v.rowIndex, b = Yt(v, zl), C = a.props, R = C.cellRenderer, z = C.fixedColumnCount, E = C.fixedRowCount;
      return R(Me(Me({}, b), {}, {
        columnIndex: m + z,
        parent: a,
        rowIndex: S + E
      }));
    }), O(a, "_cellRendererTopRightGrid", function(v) {
      var m = v.columnIndex, S = Yt(v, El), b = a.props, C = b.cellRenderer, R = b.columnCount, z = b.fixedColumnCount;
      return m === R - z ? /* @__PURE__ */ le.createElement("div", {
        key: S.key,
        style: Me(Me({}, S.style), {}, {
          width: Oi
        })
      }) : C(Me(Me({}, S), {}, {
        columnIndex: m + z,
        parent: a
      }));
    }), O(a, "_columnWidthRightGrid", function(v) {
      var m = v.index, S = a.props, b = S.columnCount, C = S.fixedColumnCount, R = S.columnWidth, z = a.state, E = z.scrollbarSize, k = z.showHorizontalScrollbar;
      return k && m === b - C ? E : typeof R == "function" ? R({
        index: m + C
      }) : R;
    }), O(a, "_onScroll", function(v) {
      var m = v.scrollLeft, S = v.scrollTop;
      a.setState({
        scrollLeft: m,
        scrollTop: S
      });
      var b = a.props.onScroll;
      b && b(v);
    }), O(a, "_onScrollbarPresenceChange", function(v) {
      var m = v.horizontal, S = v.size, b = v.vertical, C = a.state, R = C.showHorizontalScrollbar, z = C.showVerticalScrollbar;
      if (m !== R || b !== z) {
        a.setState({
          scrollbarSize: S,
          showHorizontalScrollbar: m,
          showVerticalScrollbar: b
        });
        var E = a.props.onScrollbarPresenceChange;
        typeof E == "function" && E({
          horizontal: m,
          size: S,
          vertical: b
        });
      }
    }), O(a, "_onScrollLeft", function(v) {
      var m = v.scrollLeft;
      a._onScroll({
        scrollLeft: m,
        scrollTop: a.state.scrollTop
      });
    }), O(a, "_onScrollTop", function(v) {
      var m = v.scrollTop;
      a._onScroll({
        scrollTop: m,
        scrollLeft: a.state.scrollLeft
      });
    }), O(a, "_rowHeightBottomGrid", function(v) {
      var m = v.index, S = a.props, b = S.fixedRowCount, C = S.rowCount, R = S.rowHeight, z = a.state, E = z.scrollbarSize, k = z.showVerticalScrollbar;
      return k && m === C - b ? E : typeof R == "function" ? R({
        index: m + b
      }) : R;
    }), O(a, "_topLeftGridRef", function(v) {
      a._topLeftGrid = v;
    }), O(a, "_topRightGridRef", function(v) {
      a._topRightGrid = v;
    });
    var c = r.deferredMeasurementCache, u = r.fixedColumnCount, h = r.fixedRowCount;
    return a._maybeCalculateCachedStyles(!0), c && (a._deferredMeasurementCacheBottomLeftGrid = h > 0 ? new Zn({
      cellMeasurerCache: c,
      columnIndexOffset: 0,
      rowIndexOffset: h
    }) : c, a._deferredMeasurementCacheBottomRightGrid = u > 0 || h > 0 ? new Zn({
      cellMeasurerCache: c,
      columnIndexOffset: u,
      rowIndexOffset: h
    }) : c, a._deferredMeasurementCacheTopRightGrid = u > 0 ? new Zn({
      cellMeasurerCache: c,
      columnIndexOffset: u,
      rowIndexOffset: 0
    }) : c), a;
  }
  return Ye(i, s), We(i, [{
    key: "forceUpdateGrids",
    value: function() {
      this._bottomLeftGrid && this._bottomLeftGrid.forceUpdate(), this._bottomRightGrid && this._bottomRightGrid.forceUpdate(), this._topLeftGrid && this._topLeftGrid.forceUpdate(), this._topRightGrid && this._topRightGrid.forceUpdate();
    }
    /** See Grid#invalidateCellSizeAfterRender */
  }, {
    key: "invalidateCellSizeAfterRender",
    value: function() {
      var e = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : {}, a = e.columnIndex, c = a === void 0 ? 0 : a, u = e.rowIndex, h = u === void 0 ? 0 : u;
      this._deferredInvalidateColumnIndex = typeof this._deferredInvalidateColumnIndex == "number" ? Math.min(this._deferredInvalidateColumnIndex, c) : c, this._deferredInvalidateRowIndex = typeof this._deferredInvalidateRowIndex == "number" ? Math.min(this._deferredInvalidateRowIndex, h) : h;
    }
    /** See Grid#measureAllCells */
  }, {
    key: "measureAllCells",
    value: function() {
      this._bottomLeftGrid && this._bottomLeftGrid.measureAllCells(), this._bottomRightGrid && this._bottomRightGrid.measureAllCells(), this._topLeftGrid && this._topLeftGrid.measureAllCells(), this._topRightGrid && this._topRightGrid.measureAllCells();
    }
    /** See Grid#recomputeGridSize */
  }, {
    key: "recomputeGridSize",
    value: function() {
      var e = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : {}, a = e.columnIndex, c = a === void 0 ? 0 : a, u = e.rowIndex, h = u === void 0 ? 0 : u, v = this.props, m = v.fixedColumnCount, S = v.fixedRowCount, b = Math.max(0, c - m), C = Math.max(0, h - S);
      this._bottomLeftGrid && this._bottomLeftGrid.recomputeGridSize({
        columnIndex: c,
        rowIndex: C
      }), this._bottomRightGrid && this._bottomRightGrid.recomputeGridSize({
        columnIndex: b,
        rowIndex: C
      }), this._topLeftGrid && this._topLeftGrid.recomputeGridSize({
        columnIndex: c,
        rowIndex: h
      }), this._topRightGrid && this._topRightGrid.recomputeGridSize({
        columnIndex: b,
        rowIndex: h
      }), this._leftGridWidth = null, this._topGridHeight = null, this._maybeCalculateCachedStyles(!0);
    }
  }, {
    key: "componentDidMount",
    value: function() {
      var e = this.props, a = e.scrollLeft, c = e.scrollTop;
      if (a > 0 || c > 0) {
        var u = {};
        a > 0 && (u.scrollLeft = a), c > 0 && (u.scrollTop = c), this.setState(u);
      }
      this._handleInvalidatedGridSize();
    }
  }, {
    key: "componentDidUpdate",
    value: function() {
      this._handleInvalidatedGridSize();
    }
  }, {
    key: "render",
    value: function() {
      var e = this.props, a = e.onScroll, c = e.onSectionRendered;
      e.onScrollbarPresenceChange, e.scrollLeft;
      var u = e.scrollToColumn;
      e.scrollTop;
      var h = e.scrollToRow, v = Yt(e, Ol);
      if (this._prepareForRender(), this.props.width === 0 || this.props.height === 0)
        return null;
      var m = this.state, S = m.scrollLeft, b = m.scrollTop;
      return /* @__PURE__ */ le.createElement("div", {
        style: this._containerOuterStyle
      }, /* @__PURE__ */ le.createElement("div", {
        style: this._containerTopStyle
      }, this._renderTopLeftGrid(v), this._renderTopRightGrid(Me(Me({}, v), {}, {
        onScroll: a,
        scrollLeft: S
      }))), /* @__PURE__ */ le.createElement("div", {
        style: this._containerBottomStyle
      }, this._renderBottomLeftGrid(Me(Me({}, v), {}, {
        onScroll: a,
        scrollTop: b
      })), this._renderBottomRightGrid(Me(Me({}, v), {}, {
        onScroll: a,
        onSectionRendered: c,
        scrollLeft: S,
        scrollToColumn: u,
        scrollToRow: h,
        scrollTop: b
      }))));
    }
  }, {
    key: "_getBottomGridHeight",
    value: function(e) {
      var a = e.height, c = this._getTopGridHeight(e);
      return a - c;
    }
  }, {
    key: "_getLeftGridWidth",
    value: function(e) {
      var a = e.fixedColumnCount, c = e.columnWidth;
      if (this._leftGridWidth == null)
        if (typeof c == "function") {
          for (var u = 0, h = 0; h < a; h++)
            u += c({
              index: h
            });
          this._leftGridWidth = u;
        } else
          this._leftGridWidth = c * a;
      return this._leftGridWidth;
    }
  }, {
    key: "_getRightGridWidth",
    value: function(e) {
      var a = e.width, c = this._getLeftGridWidth(e);
      return a - c;
    }
  }, {
    key: "_getTopGridHeight",
    value: function(e) {
      var a = e.fixedRowCount, c = e.rowHeight;
      if (this._topGridHeight == null)
        if (typeof c == "function") {
          for (var u = 0, h = 0; h < a; h++)
            u += c({
              index: h
            });
          this._topGridHeight = u;
        } else
          this._topGridHeight = c * a;
      return this._topGridHeight;
    }
  }, {
    key: "_handleInvalidatedGridSize",
    value: function() {
      if (typeof this._deferredInvalidateColumnIndex == "number") {
        var e = this._deferredInvalidateColumnIndex, a = this._deferredInvalidateRowIndex;
        this._deferredInvalidateColumnIndex = null, this._deferredInvalidateRowIndex = null, this.recomputeGridSize({
          columnIndex: e,
          rowIndex: a
        }), this.forceUpdate();
      }
    }
    /**
     * Avoid recreating inline styles each render; this bypasses Grid's shallowCompare.
     * This method recalculates styles only when specific props change.
     */
  }, {
    key: "_maybeCalculateCachedStyles",
    value: function(e) {
      var a = this.props, c = a.columnWidth, u = a.enableFixedColumnScroll, h = a.enableFixedRowScroll, v = a.height, m = a.fixedColumnCount, S = a.fixedRowCount, b = a.rowHeight, C = a.style, R = a.styleBottomLeftGrid, z = a.styleBottomRightGrid, E = a.styleTopLeftGrid, k = a.styleTopRightGrid, L = a.width, q = e || v !== this._lastRenderedHeight || L !== this._lastRenderedWidth, P = e || c !== this._lastRenderedColumnWidth || m !== this._lastRenderedFixedColumnCount, W = e || S !== this._lastRenderedFixedRowCount || b !== this._lastRenderedRowHeight;
      (e || q || C !== this._lastRenderedStyle) && (this._containerOuterStyle = Me({
        height: v,
        overflow: "visible",
        // Let :focus outline show through
        width: L
      }, C)), (e || q || W) && (this._containerTopStyle = {
        height: this._getTopGridHeight(this.props),
        position: "relative",
        width: L
      }, this._containerBottomStyle = {
        height: v - this._getTopGridHeight(this.props),
        overflow: "visible",
        // Let :focus outline show through
        position: "relative",
        width: L
      }), (e || R !== this._lastRenderedStyleBottomLeftGrid) && (this._bottomLeftGridStyle = Me({
        left: 0,
        overflowX: "hidden",
        overflowY: u ? "auto" : "hidden",
        position: "absolute"
      }, R)), (e || P || z !== this._lastRenderedStyleBottomRightGrid) && (this._bottomRightGridStyle = Me({
        left: this._getLeftGridWidth(this.props),
        position: "absolute"
      }, z)), (e || E !== this._lastRenderedStyleTopLeftGrid) && (this._topLeftGridStyle = Me({
        left: 0,
        overflowX: "hidden",
        overflowY: "hidden",
        position: "absolute",
        top: 0
      }, E)), (e || P || k !== this._lastRenderedStyleTopRightGrid) && (this._topRightGridStyle = Me({
        left: this._getLeftGridWidth(this.props),
        overflowX: h ? "auto" : "hidden",
        overflowY: "hidden",
        position: "absolute",
        top: 0
      }, k)), this._lastRenderedColumnWidth = c, this._lastRenderedFixedColumnCount = m, this._lastRenderedFixedRowCount = S, this._lastRenderedHeight = v, this._lastRenderedRowHeight = b, this._lastRenderedStyle = C, this._lastRenderedStyleBottomLeftGrid = R, this._lastRenderedStyleBottomRightGrid = z, this._lastRenderedStyleTopLeftGrid = E, this._lastRenderedStyleTopRightGrid = k, this._lastRenderedWidth = L;
    }
  }, {
    key: "_prepareForRender",
    value: function() {
      (this._lastRenderedColumnWidth !== this.props.columnWidth || this._lastRenderedFixedColumnCount !== this.props.fixedColumnCount) && (this._leftGridWidth = null), (this._lastRenderedFixedRowCount !== this.props.fixedRowCount || this._lastRenderedRowHeight !== this.props.rowHeight) && (this._topGridHeight = null), this._maybeCalculateCachedStyles(), this._lastRenderedColumnWidth = this.props.columnWidth, this._lastRenderedFixedColumnCount = this.props.fixedColumnCount, this._lastRenderedFixedRowCount = this.props.fixedRowCount, this._lastRenderedRowHeight = this.props.rowHeight;
    }
  }, {
    key: "_renderBottomLeftGrid",
    value: function(e) {
      var a = e.enableFixedColumnScroll, c = e.fixedColumnCount, u = e.fixedRowCount, h = e.rowCount, v = e.hideBottomLeftGridScrollbar, m = this.state.showVerticalScrollbar;
      if (!c)
        return null;
      var S = m ? 1 : 0, b = this._getBottomGridHeight(e), C = this._getLeftGridWidth(e), R = this.state.showVerticalScrollbar ? this.state.scrollbarSize : 0, z = v ? C + R : C, E = /* @__PURE__ */ le.createElement(lt, tt({}, e, {
        cellRenderer: this._cellRendererBottomLeftGrid,
        className: this.props.classNameBottomLeftGrid,
        columnCount: c,
        deferredMeasurementCache: this._deferredMeasurementCacheBottomLeftGrid,
        height: b,
        onScroll: a ? this._onScrollTop : void 0,
        ref: this._bottomLeftGridRef,
        rowCount: Math.max(0, h - u) + S,
        rowHeight: this._rowHeightBottomGrid,
        style: this._bottomLeftGridStyle,
        tabIndex: null,
        width: z
      }));
      return v ? /* @__PURE__ */ le.createElement("div", {
        className: "BottomLeftGrid_ScrollWrapper",
        style: Me(Me({}, this._bottomLeftGridStyle), {}, {
          height: b,
          width: C,
          overflowY: "hidden"
        })
      }, E) : E;
    }
  }, {
    key: "_renderBottomRightGrid",
    value: function(e) {
      var a = e.columnCount, c = e.fixedColumnCount, u = e.fixedRowCount, h = e.rowCount, v = e.scrollToColumn, m = e.scrollToRow;
      return /* @__PURE__ */ le.createElement(lt, tt({}, e, {
        cellRenderer: this._cellRendererBottomRightGrid,
        className: this.props.classNameBottomRightGrid,
        columnCount: Math.max(0, a - c),
        columnWidth: this._columnWidthRightGrid,
        deferredMeasurementCache: this._deferredMeasurementCacheBottomRightGrid,
        height: this._getBottomGridHeight(e),
        onScroll: this._onScroll,
        onScrollbarPresenceChange: this._onScrollbarPresenceChange,
        ref: this._bottomRightGridRef,
        rowCount: Math.max(0, h - u),
        rowHeight: this._rowHeightBottomGrid,
        scrollToColumn: v - c,
        scrollToRow: m - u,
        style: this._bottomRightGridStyle,
        width: this._getRightGridWidth(e)
      }));
    }
  }, {
    key: "_renderTopLeftGrid",
    value: function(e) {
      var a = e.fixedColumnCount, c = e.fixedRowCount;
      return !a || !c ? null : /* @__PURE__ */ le.createElement(lt, tt({}, e, {
        className: this.props.classNameTopLeftGrid,
        columnCount: a,
        height: this._getTopGridHeight(e),
        ref: this._topLeftGridRef,
        rowCount: c,
        style: this._topLeftGridStyle,
        tabIndex: null,
        width: this._getLeftGridWidth(e)
      }));
    }
  }, {
    key: "_renderTopRightGrid",
    value: function(e) {
      var a = e.columnCount, c = e.enableFixedRowScroll, u = e.fixedColumnCount, h = e.fixedRowCount, v = e.scrollLeft, m = e.hideTopRightGridScrollbar, S = this.state, b = S.showHorizontalScrollbar, C = S.scrollbarSize;
      if (!h)
        return null;
      var R = b ? 1 : 0, z = this._getTopGridHeight(e), E = this._getRightGridWidth(e), k = b ? C : 0, L = z, q = this._topRightGridStyle;
      m && (L = z + k, q = Me(Me({}, this._topRightGridStyle), {}, {
        left: 0
      }));
      var P = /* @__PURE__ */ le.createElement(lt, tt({}, e, {
        cellRenderer: this._cellRendererTopRightGrid,
        className: this.props.classNameTopRightGrid,
        columnCount: Math.max(0, a - u) + R,
        columnWidth: this._columnWidthRightGrid,
        deferredMeasurementCache: this._deferredMeasurementCacheTopRightGrid,
        height: L,
        onScroll: c ? this._onScrollLeft : void 0,
        ref: this._topRightGridRef,
        rowCount: h,
        scrollLeft: v,
        style: q,
        tabIndex: null,
        width: E
      }));
      return m ? /* @__PURE__ */ le.createElement("div", {
        className: "TopRightGrid_ScrollWrapper",
        style: Me(Me({}, this._topRightGridStyle), {}, {
          height: z,
          width: E,
          overflowX: "hidden"
        })
      }, P) : P;
    }
  }], [{
    key: "getDerivedStateFromProps",
    value: function(e, a) {
      return e.scrollLeft !== a.scrollLeft || e.scrollTop !== a.scrollTop ? {
        scrollLeft: e.scrollLeft != null && e.scrollLeft >= 0 ? e.scrollLeft : a.scrollLeft,
        scrollTop: e.scrollTop != null && e.scrollTop >= 0 ? e.scrollTop : a.scrollTop
      } : null;
    }
  }]);
})(le.PureComponent);
O(vr, "defaultProps", {
  classNameBottomLeftGrid: "",
  classNameBottomRightGrid: "",
  classNameTopLeftGrid: "",
  classNameTopRightGrid: "",
  enableFixedColumnScroll: !1,
  enableFixedRowScroll: !1,
  fixedColumnCount: 0,
  fixedRowCount: 0,
  scrollToColumn: -1,
  scrollToRow: -1,
  style: {},
  styleBottomLeftGrid: {},
  styleBottomRightGrid: {},
  styleTopLeftGrid: {},
  styleTopRightGrid: {},
  hideTopRightGridScrollbar: !1,
  hideBottomLeftGridScrollbar: !1
});
vr.propTypes = process.env.NODE_ENV !== "production" ? {
  classNameBottomLeftGrid: D.string.isRequired,
  classNameBottomRightGrid: D.string.isRequired,
  classNameTopLeftGrid: D.string.isRequired,
  classNameTopRightGrid: D.string.isRequired,
  enableFixedColumnScroll: D.bool.isRequired,
  enableFixedRowScroll: D.bool.isRequired,
  fixedColumnCount: D.number.isRequired,
  fixedRowCount: D.number.isRequired,
  onScrollbarPresenceChange: D.func,
  style: D.object.isRequired,
  styleBottomLeftGrid: D.object.isRequired,
  styleBottomRightGrid: D.object.isRequired,
  styleTopLeftGrid: D.object.isRequired,
  styleTopRightGrid: D.object.isRequired,
  hideTopRightGridScrollbar: D.bool,
  hideBottomLeftGridScrollbar: D.bool
} : {};
nn(vr);
function Ml(s, i, r) {
  return i = ze(i), Xe(s, Ro() ? Reflect.construct(i, r || [], ze(s).constructor) : i.apply(s, r));
}
function Ro() {
  try {
    var s = !Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function() {
    }));
  } catch {
  }
  return (Ro = function() {
    return !!s;
  })();
}
var To = /* @__PURE__ */ (function(s) {
  function i(r, e) {
    var a;
    return Ge(this, i), a = Ml(this, i, [r, e]), a.state = {
      clientHeight: 0,
      clientWidth: 0,
      scrollHeight: 0,
      scrollLeft: 0,
      scrollTop: 0,
      scrollWidth: 0
    }, a._onScroll = a._onScroll.bind(a), a;
  }
  return Ye(i, s), We(i, [{
    key: "render",
    value: function() {
      var e = this.props.children, a = this.state, c = a.clientHeight, u = a.clientWidth, h = a.scrollHeight, v = a.scrollLeft, m = a.scrollTop, S = a.scrollWidth;
      return e({
        clientHeight: c,
        clientWidth: u,
        onScroll: this._onScroll,
        scrollHeight: h,
        scrollLeft: v,
        scrollTop: m,
        scrollWidth: S
      });
    }
  }, {
    key: "_onScroll",
    value: function(e) {
      var a = e.clientHeight, c = e.clientWidth, u = e.scrollHeight, h = e.scrollLeft, v = e.scrollTop, m = e.scrollWidth;
      this.setState({
        clientHeight: a,
        clientWidth: c,
        scrollHeight: u,
        scrollLeft: h,
        scrollTop: v,
        scrollWidth: m
      });
    }
  }]);
})(le.PureComponent);
To.propTypes = process.env.NODE_ENV !== "production" ? {
  /**
   * Function responsible for rendering 2 or more virtualized components.
   * This function should implement the following signature:
   * ({ onScroll, scrollLeft, scrollTop }) => PropTypes.element
   */
  children: D.func.isRequired
} : {};
function Al(s) {
  var i = s.dataKey, r = s.rowData;
  return typeof r.get == "function" ? r.get(i) : r[i];
}
function kl(s) {
  var i = s.cellData;
  return i == null ? "" : String(i);
}
function Dl(s) {
  var i = s.className, r = s.columns, e = s.style;
  return /* @__PURE__ */ le.createElement("div", {
    className: i,
    role: "row",
    style: e
  }, r);
}
var Je = {
  /**
   * Sort items in ascending order.
   * This means arranging from the lowest value to the highest (e.g. a-z, 0-9).
   */
  ASC: "ASC",
  /**
   * Sort items in descending order.
   * This means arranging from the highest value to the lowest (e.g. z-a, 9-0).
   */
  DESC: "DESC"
};
function Io(s) {
  var i = s.sortDirection, r = rt("ReactVirtualized__Table__sortableHeaderIcon", {
    "ReactVirtualized__Table__sortableHeaderIcon--ASC": i === Je.ASC,
    "ReactVirtualized__Table__sortableHeaderIcon--DESC": i === Je.DESC
  });
  return /* @__PURE__ */ le.createElement("svg", {
    className: r,
    width: 18,
    height: 18,
    viewBox: "0 0 24 24"
  }, i === Je.ASC ? /* @__PURE__ */ le.createElement("path", {
    d: "M7 14l5-5 5 5z"
  }) : /* @__PURE__ */ le.createElement("path", {
    d: "M7 10l5 5 5-5z"
  }), /* @__PURE__ */ le.createElement("path", {
    d: "M0 0h24v24H0z",
    fill: "none"
  }));
}
Io.propTypes = process.env.NODE_ENV !== "production" ? {
  sortDirection: D.oneOf([Je.ASC, Je.DESC])
} : {};
function Ll(s) {
  var i = s.dataKey, r = s.label, e = s.sortBy, a = s.sortDirection, c = e === i, u = [/* @__PURE__ */ le.createElement("span", {
    className: "ReactVirtualized__Table__headerTruncatedText",
    key: "label",
    title: typeof r == "string" ? r : null
  }, r)];
  return c && u.push(/* @__PURE__ */ le.createElement(Io, {
    key: "SortIndicator",
    sortDirection: a
  })), u;
}
function Gl(s) {
  var i = s.className, r = s.columns, e = s.index, a = s.key, c = s.onRowClick, u = s.onRowDoubleClick, h = s.onRowMouseOut, v = s.onRowMouseOver, m = s.onRowRightClick, S = s.rowData, b = s.style, C = {
    "aria-rowindex": e + 1
  };
  return (c || u || h || v || m) && (C["aria-label"] = "row", C.tabIndex = 0, c && (C.onClick = function(R) {
    return c({
      event: R,
      index: e,
      rowData: S
    });
  }), u && (C.onDoubleClick = function(R) {
    return u({
      event: R,
      index: e,
      rowData: S
    });
  }), h && (C.onMouseOut = function(R) {
    return h({
      event: R,
      index: e,
      rowData: S
    });
  }), v && (C.onMouseOver = function(R) {
    return v({
      event: R,
      index: e,
      rowData: S
    });
  }), m && (C.onContextMenu = function(R) {
    return m({
      event: R,
      index: e,
      rowData: S
    });
  })), /* @__PURE__ */ le.createElement("div", tt({}, C, {
    className: i,
    key: a,
    role: "row",
    style: b
  }), r);
}
function Wl(s, i, r) {
  return i = ze(i), Xe(s, zo() ? Reflect.construct(i, r || [], ze(s).constructor) : i.apply(s, r));
}
function zo() {
  try {
    var s = !Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function() {
    }));
  } catch {
  }
  return (zo = function() {
    return !!s;
  })();
}
var tn = /* @__PURE__ */ (function(s) {
  function i() {
    return Ge(this, i), Wl(this, i, arguments);
  }
  return Ye(i, s), We(i);
})(le.Component);
O(tn, "defaultProps", {
  cellDataGetter: Al,
  cellRenderer: kl,
  defaultSortDirection: Je.ASC,
  flexGrow: 0,
  flexShrink: 1,
  headerRenderer: Ll,
  style: {}
});
tn.propTypes = process.env.NODE_ENV !== "production" ? {
  /** Optional aria-label value to set on the column header */
  "aria-label": D.string,
  /**
   * Callback responsible for returning a cell's data, given its :dataKey
   * ({ columnData: any, dataKey: string, rowData: any }): any
   */
  cellDataGetter: D.func,
  /**
   * Callback responsible for rendering a cell's contents.
   * ({ cellData: any, columnData: any, dataKey: string, rowData: any, rowIndex: number }): node
   */
  cellRenderer: D.func,
  /** Optional CSS class to apply to cell */
  className: D.string,
  /** Optional additional data passed to this column's :cellDataGetter */
  columnData: D.object,
  /** Uniquely identifies the row-data attribute corresponding to this cell */
  dataKey: D.any.isRequired,
  /** Optional direction to be used when clicked the first time */
  defaultSortDirection: D.oneOf([Je.ASC, Je.DESC]),
  /** If sort is enabled for the table at large, disable it for this column */
  disableSort: D.bool,
  /** Flex grow style; defaults to 0 */
  flexGrow: D.number,
  /** Flex shrink style; defaults to 1 */
  flexShrink: D.number,
  /** Optional CSS class to apply to this column's header */
  headerClassName: D.string,
  /**
   * Optional callback responsible for rendering a column header contents.
   * ({ columnData: object, dataKey: string, disableSort: boolean, label: node, sortBy: string, sortDirection: string }): PropTypes.node
   */
  headerRenderer: D.func.isRequired,
  /** Optional inline style to apply to this column's header */
  headerStyle: D.object,
  /** Optional id to set on the column header */
  id: D.string,
  /** Header label for this column */
  label: D.node,
  /** Maximum width of column; this property will only be used if :flexGrow is > 0. */
  maxWidth: D.number,
  /** Minimum width of column. */
  minWidth: D.number,
  /** Optional inline style to apply to cell */
  style: D.object,
  /** Flex basis (width) for this column; This value can grow or shrink based on :flexGrow and :flexShrink properties. */
  width: D.number.isRequired
} : {};
function Pi(s, i) {
  var r = Object.keys(s);
  if (Object.getOwnPropertySymbols) {
    var e = Object.getOwnPropertySymbols(s);
    i && (e = e.filter(function(a) {
      return Object.getOwnPropertyDescriptor(s, a).enumerable;
    })), r.push.apply(r, e);
  }
  return r;
}
function at(s) {
  for (var i = 1; i < arguments.length; i++) {
    var r = arguments[i] != null ? arguments[i] : {};
    i % 2 ? Pi(Object(r), !0).forEach(function(e) {
      O(s, e, r[e]);
    }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(s, Object.getOwnPropertyDescriptors(r)) : Pi(Object(r)).forEach(function(e) {
      Object.defineProperty(s, e, Object.getOwnPropertyDescriptor(r, e));
    });
  }
  return s;
}
function jl(s, i, r) {
  return i = ze(i), Xe(s, Eo() ? Reflect.construct(i, r || [], ze(s).constructor) : i.apply(s, r));
}
function Eo() {
  try {
    var s = !Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function() {
    }));
  } catch {
  }
  return (Eo = function() {
    return !!s;
  })();
}
var Oo = /* @__PURE__ */ (function(s) {
  function i(r) {
    var e;
    return Ge(this, i), e = jl(this, i, [r]), e.state = {
      scrollbarWidth: 0
    }, e._createColumn = e._createColumn.bind(e), e._createRow = e._createRow.bind(e), e._onScroll = e._onScroll.bind(e), e._onSectionRendered = e._onSectionRendered.bind(e), e._setRef = e._setRef.bind(e), e._setGridElementRef = e._setGridElementRef.bind(e), e;
  }
  return Ye(i, s), We(i, [{
    key: "forceUpdateGrid",
    value: function() {
      this.Grid && this.Grid.forceUpdate();
    }
    /** See Grid#getOffsetForCell */
  }, {
    key: "getOffsetForRow",
    value: function(e) {
      var a = e.alignment, c = e.index;
      if (this.Grid) {
        var u = this.Grid.getOffsetForCell({
          alignment: a,
          rowIndex: c
        }), h = u.scrollTop;
        return h;
      }
      return 0;
    }
    /** CellMeasurer compatibility */
  }, {
    key: "invalidateCellSizeAfterRender",
    value: function(e) {
      var a = e.columnIndex, c = e.rowIndex;
      this.Grid && this.Grid.invalidateCellSizeAfterRender({
        rowIndex: c,
        columnIndex: a
      });
    }
    /** See Grid#measureAllCells */
  }, {
    key: "measureAllRows",
    value: function() {
      this.Grid && this.Grid.measureAllCells();
    }
    /** CellMeasurer compatibility */
  }, {
    key: "recomputeGridSize",
    value: function() {
      var e = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : {}, a = e.columnIndex, c = a === void 0 ? 0 : a, u = e.rowIndex, h = u === void 0 ? 0 : u;
      this.Grid && this.Grid.recomputeGridSize({
        rowIndex: h,
        columnIndex: c
      });
    }
    /** See Grid#recomputeGridSize */
  }, {
    key: "recomputeRowHeights",
    value: function() {
      var e = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : 0;
      this.Grid && this.Grid.recomputeGridSize({
        rowIndex: e
      });
    }
    /** See Grid#scrollToPosition */
  }, {
    key: "scrollToPosition",
    value: function() {
      var e = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : 0;
      this.Grid && this.Grid.scrollToPosition({
        scrollTop: e
      });
    }
    /** See Grid#scrollToCell */
  }, {
    key: "scrollToRow",
    value: function() {
      var e = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : 0;
      this.Grid && this.Grid.scrollToCell({
        columnIndex: 0,
        rowIndex: e
      });
    }
  }, {
    key: "getScrollbarWidth",
    value: function() {
      if (this.GridElement) {
        var e = this.GridElement, a = e.clientWidth || 0, c = e.offsetWidth || 0;
        return c - a;
      }
      return 0;
    }
  }, {
    key: "componentDidMount",
    value: function() {
      this._setScrollbarWidth();
    }
  }, {
    key: "componentDidUpdate",
    value: function() {
      this._setScrollbarWidth();
    }
  }, {
    key: "render",
    value: function() {
      var e = this, a = this.props, c = a.children, u = a.className, h = a.disableHeader, v = a.gridClassName, m = a.gridStyle, S = a.headerHeight, b = a.headerRowRenderer, C = a.height, R = a.id, z = a.noRowsRenderer, E = a.rowClassName, k = a.rowStyle, L = a.scrollToIndex, q = a.style, P = a.width, W = this.state.scrollbarWidth, I = h ? C : C - S, V = typeof E == "function" ? E({
        index: -1
      }) : E, x = typeof k == "function" ? k({
        index: -1
      }) : k;
      return this._cachedColumnStyles = [], le.Children.toArray(c).forEach(function(j, ie) {
        var te = e._getFlexStyleForColumn(j, j.props.style || tn.defaultProps.style);
        e._cachedColumnStyles[ie] = at({
          overflow: "hidden"
        }, te);
      }), /* @__PURE__ */ le.createElement("div", {
        "aria-label": this.props["aria-label"],
        "aria-labelledby": this.props["aria-labelledby"],
        "aria-colcount": le.Children.toArray(c).length,
        "aria-rowcount": this.props.rowCount,
        className: rt("ReactVirtualized__Table", u),
        id: R,
        role: "grid",
        style: q
      }, !h && b({
        className: rt("ReactVirtualized__Table__headerRow", V),
        columns: this._getHeaderColumns(),
        style: at({
          height: S,
          overflow: "hidden",
          paddingRight: W,
          width: P
        }, x)
      }), /* @__PURE__ */ le.createElement(lt, tt({}, this.props, {
        elementRef: this._setGridElementRef,
        "aria-readonly": null,
        autoContainerWidth: !0,
        className: rt("ReactVirtualized__Table__Grid", v),
        cellRenderer: this._createRow,
        columnWidth: P,
        columnCount: 1,
        height: I,
        id: void 0,
        noContentRenderer: z,
        onScroll: this._onScroll,
        onSectionRendered: this._onSectionRendered,
        ref: this._setRef,
        role: "rowgroup",
        scrollbarWidth: W,
        scrollToRow: L,
        style: at(at({}, m), {}, {
          overflowX: "hidden"
        })
      })));
    }
  }, {
    key: "_createColumn",
    value: function(e) {
      var a = e.column, c = e.columnIndex, u = e.isScrolling, h = e.parent, v = e.rowData, m = e.rowIndex, S = this.props.onColumnClick, b = a.props, C = b.cellDataGetter, R = b.cellRenderer, z = b.className, E = b.columnData, k = b.dataKey, L = b.id, q = C({
        columnData: E,
        dataKey: k,
        rowData: v
      }), P = R({
        cellData: q,
        columnData: E,
        columnIndex: c,
        dataKey: k,
        isScrolling: u,
        parent: h,
        rowData: v,
        rowIndex: m
      }), W = function(j) {
        S && S({
          columnData: E,
          dataKey: k,
          event: j
        });
      }, I = this._cachedColumnStyles[c], V = typeof P == "string" ? P : null;
      return /* @__PURE__ */ le.createElement("div", {
        "aria-colindex": c + 1,
        "aria-describedby": L,
        className: rt("ReactVirtualized__Table__rowColumn", z),
        key: "Row" + m + "-Col" + c,
        onClick: W,
        role: "gridcell",
        style: I,
        title: V
      }, P);
    }
  }, {
    key: "_createHeader",
    value: function(e) {
      var a = e.column, c = e.index, u = this.props, h = u.headerClassName, v = u.headerStyle, m = u.onHeaderClick, S = u.sort, b = u.sortBy, C = u.sortDirection, R = a.props, z = R.columnData, E = R.dataKey, k = R.defaultSortDirection, L = R.disableSort, q = R.headerRenderer, P = R.id, W = R.label, I = !L && S, V = rt("ReactVirtualized__Table__headerColumn", h, a.props.headerClassName, {
        ReactVirtualized__Table__sortableHeaderColumn: I
      }), x = this._getFlexStyleForColumn(a, at(at({}, v), a.props.headerStyle)), j = q({
        columnData: z,
        dataKey: E,
        disableSort: L,
        label: W,
        sortBy: b,
        sortDirection: C
      }), ie, te, Q, ce, de;
      if (I || m) {
        var he = b !== E, pe = he ? k : C === Je.DESC ? Je.ASC : Je.DESC, Se = function(Re) {
          I && S({
            defaultSortDirection: k,
            event: Re,
            sortBy: E,
            sortDirection: pe
          }), m && m({
            columnData: z,
            dataKey: E,
            event: Re
          });
        }, Te = function(Re) {
          (Re.key === "Enter" || Re.key === " ") && Se(Re);
        };
        de = a.props["aria-label"] || W || E, ce = "none", Q = 0, ie = Se, te = Te;
      }
      return b === E && (ce = C === Je.ASC ? "ascending" : "descending"), /* @__PURE__ */ le.createElement("div", {
        "aria-label": de,
        "aria-sort": ce,
        className: V,
        id: P,
        key: "Header-Col" + c,
        onClick: ie,
        onKeyDown: te,
        role: "columnheader",
        style: x,
        tabIndex: Q
      }, j);
    }
  }, {
    key: "_createRow",
    value: function(e) {
      var a = this, c = e.rowIndex, u = e.isScrolling, h = e.key, v = e.parent, m = e.style, S = this.props, b = S.children, C = S.onRowClick, R = S.onRowDoubleClick, z = S.onRowRightClick, E = S.onRowMouseOver, k = S.onRowMouseOut, L = S.rowClassName, q = S.rowGetter, P = S.rowRenderer, W = S.rowStyle, I = this.state.scrollbarWidth, V = typeof L == "function" ? L({
        index: c
      }) : L, x = typeof W == "function" ? W({
        index: c
      }) : W, j = q({
        index: c
      }), ie = le.Children.toArray(b).map(function(ce, de) {
        return a._createColumn({
          column: ce,
          columnIndex: de,
          isScrolling: u,
          parent: v,
          rowData: j,
          rowIndex: c,
          scrollbarWidth: I
        });
      }), te = rt("ReactVirtualized__Table__row", V), Q = at(at({}, m), {}, {
        height: this._getRowHeight(c),
        overflow: "hidden",
        paddingRight: I
      }, x);
      return P({
        className: te,
        columns: ie,
        index: c,
        isScrolling: u,
        key: h,
        onRowClick: C,
        onRowDoubleClick: R,
        onRowRightClick: z,
        onRowMouseOver: E,
        onRowMouseOut: k,
        rowData: j,
        style: Q
      });
    }
    /**
     * Determines the flex-shrink, flex-grow, and width values for a cell (header or column).
     */
  }, {
    key: "_getFlexStyleForColumn",
    value: function(e) {
      var a = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {}, c = "".concat(e.props.flexGrow, " ").concat(e.props.flexShrink, " ").concat(e.props.width, "px"), u = at(at({}, a), {}, {
        flex: c,
        msFlex: c,
        WebkitFlex: c
      });
      return e.props.maxWidth && (u.maxWidth = e.props.maxWidth), e.props.minWidth && (u.minWidth = e.props.minWidth), u;
    }
  }, {
    key: "_getHeaderColumns",
    value: function() {
      var e = this, a = this.props, c = a.children, u = a.disableHeader, h = u ? [] : le.Children.toArray(c);
      return h.map(function(v, m) {
        return e._createHeader({
          column: v,
          index: m
        });
      });
    }
  }, {
    key: "_getRowHeight",
    value: function(e) {
      var a = this.props.rowHeight;
      return typeof a == "function" ? a({
        index: e
      }) : a;
    }
  }, {
    key: "_onScroll",
    value: function(e) {
      var a = e.clientHeight, c = e.scrollHeight, u = e.scrollTop, h = this.props.onScroll;
      h({
        clientHeight: a,
        scrollHeight: c,
        scrollTop: u
      });
    }
  }, {
    key: "_onSectionRendered",
    value: function(e) {
      var a = e.rowOverscanStartIndex, c = e.rowOverscanStopIndex, u = e.rowStartIndex, h = e.rowStopIndex, v = this.props.onRowsRendered;
      v({
        overscanStartIndex: a,
        overscanStopIndex: c,
        startIndex: u,
        stopIndex: h
      });
    }
  }, {
    key: "_setRef",
    value: function(e) {
      this.Grid = e;
    }
  }, {
    key: "_setGridElementRef",
    value: function(e) {
      this.GridElement = e;
    }
  }, {
    key: "_setScrollbarWidth",
    value: function() {
      var e = this.getScrollbarWidth();
      this.setState({
        scrollbarWidth: e
      });
    }
  }]);
})(le.PureComponent);
O(Oo, "defaultProps", {
  disableHeader: !1,
  estimatedRowSize: 30,
  headerHeight: 0,
  headerStyle: {},
  noRowsRenderer: function() {
    return null;
  },
  onRowsRendered: function() {
    return null;
  },
  onScroll: function() {
    return null;
  },
  overscanIndicesGetter: fo,
  overscanRowCount: 10,
  rowRenderer: Gl,
  headerRowRenderer: Dl,
  rowStyle: {},
  scrollToAlignment: "auto",
  scrollToIndex: -1,
  style: {}
});
Oo.propTypes = process.env.NODE_ENV !== "production" ? {
  /** This is just set on the grid top element. */
  "aria-label": D.string,
  /** This is just set on the grid top element. */
  "aria-labelledby": D.string,
  /**
   * Removes fixed height from the scrollingContainer so that the total height
   * of rows can stretch the window. Intended for use with WindowScroller
   */
  autoHeight: D.bool,
  /** One or more Columns describing the data displayed in this row */
  children: function(i) {
    for (var r = le.Children.toArray(i.children), e = 0; e < r.length; e++) {
      var a = r[e].type;
      if (a !== tn && !(a.prototype instanceof tn))
        return new Error("Table only accepts children of type Column");
    }
  },
  /** Optional CSS class name */
  className: D.string,
  /** Disable rendering the header at all */
  disableHeader: D.bool,
  /**
   * Used to estimate the total height of a Table before all of its rows have actually been measured.
   * The estimated total height is adjusted as rows are rendered.
   */
  estimatedRowSize: D.number.isRequired,
  /** Optional custom CSS class name to attach to inner Grid element. */
  gridClassName: D.string,
  /** Optional inline style to attach to inner Grid element. */
  gridStyle: D.object,
  /** Optional CSS class to apply to all column headers */
  headerClassName: D.string,
  /** Fixed height of header row */
  headerHeight: D.number.isRequired,
  /**
   * Responsible for rendering a table row given an array of columns:
   * Should implement the following interface: ({
   *   className: string,
   *   columns: any[],
   *   style: any
   * }): PropTypes.node
   */
  headerRowRenderer: D.func,
  /** Optional custom inline style to attach to table header columns. */
  headerStyle: D.object,
  /** Fixed/available height for out DOM element */
  height: D.number.isRequired,
  /** Optional id */
  id: D.string,
  /** Optional renderer to be used in place of table body rows when rowCount is 0 */
  noRowsRenderer: D.func,
  /**
   * Optional callback when a column is clicked.
   * ({ columnData: any, dataKey: string }): void
   */
  onColumnClick: D.func,
  /**
   * Optional callback when a column's header is clicked.
   * ({ columnData: any, dataKey: string }): void
   */
  onHeaderClick: D.func,
  /**
   * Callback invoked when a user clicks on a table row.
   * ({ index: number }): void
   */
  onRowClick: D.func,
  /**
   * Callback invoked when a user double-clicks on a table row.
   * ({ index: number }): void
   */
  onRowDoubleClick: D.func,
  /**
   * Callback invoked when the mouse leaves a table row.
   * ({ index: number }): void
   */
  onRowMouseOut: D.func,
  /**
   * Callback invoked when a user moves the mouse over a table row.
   * ({ index: number }): void
   */
  onRowMouseOver: D.func,
  /**
   * Callback invoked when a user right-clicks on a table row.
   * ({ index: number }): void
   */
  onRowRightClick: D.func,
  /**
   * Callback invoked with information about the slice of rows that were just rendered.
   * ({ startIndex, stopIndex }): void
   */
  onRowsRendered: D.func,
  /**
   * Callback invoked whenever the scroll offset changes within the inner scrollable region.
   * This callback can be used to sync scrolling between lists, tables, or grids.
   * ({ clientHeight, scrollHeight, scrollTop }): void
   */
  onScroll: D.func.isRequired,
  /** See Grid#overscanIndicesGetter */
  overscanIndicesGetter: D.func.isRequired,
  /**
   * Number of rows to render above/below the visible bounds of the list.
   * These rows can help for smoother scrolling on touch devices.
   */
  overscanRowCount: D.number.isRequired,
  /**
   * Optional CSS class to apply to all table rows (including the header row).
   * This property can be a CSS class name (string) or a function that returns a class name.
   * If a function is provided its signature should be: ({ index: number }): string
   */
  rowClassName: D.oneOfType([D.string, D.func]),
  /**
   * Callback responsible for returning a data row given an index.
   * ({ index: number }): any
   */
  rowGetter: D.func.isRequired,
  /**
   * Either a fixed row height (number) or a function that returns the height of a row given its index.
   * ({ index: number }): number
   */
  rowHeight: D.oneOfType([D.number, D.func]).isRequired,
  /** Number of rows in table. */
  rowCount: D.number.isRequired,
  /**
   * Responsible for rendering a table row given an array of columns:
   * Should implement the following interface: ({
   *   className: string,
   *   columns: Array,
   *   index: number,
   *   isScrolling: boolean,
   *   onRowClick: ?Function,
   *   onRowDoubleClick: ?Function,
   *   onRowMouseOver: ?Function,
   *   onRowMouseOut: ?Function,
   *   rowData: any,
   *   style: any
   * }): PropTypes.node
   */
  rowRenderer: D.func,
  /** Optional custom inline style to attach to table rows. */
  rowStyle: D.oneOfType([D.object, D.func]).isRequired,
  /** See Grid#scrollToAlignment */
  scrollToAlignment: D.oneOf(["auto", "end", "start", "center"]).isRequired,
  /** Row index to ensure visible (by forcefully scrolling if necessary) */
  scrollToIndex: D.number.isRequired,
  /** Vertical offset. */
  scrollTop: D.number,
  /**
   * Sort function to be called if a sortable header is clicked.
   * Should implement the following interface: ({
   *   defaultSortDirection: 'ASC' | 'DESC',
   *   event: MouseEvent,
   *   sortBy: string,
   *   sortDirection: SortDirection
   * }): void
   */
  sort: D.func,
  /** Table data is currently sorted by this :dataKey (if it is sorted at all) */
  sortBy: D.string,
  /** Table data is currently sorted in this direction (if it is sorted at all) */
  sortDirection: D.oneOf([Je.ASC, Je.DESC]),
  /** Optional inline style */
  style: D.object,
  /** Tab index for focus */
  tabIndex: D.number,
  /** Width of list */
  width: D.number.isRequired
} : {};
var Ct = [], Qt = null, zt = null;
function Po() {
  zt && (zt = null, document.body && Qt != null && (document.body.style.pointerEvents = Qt), Qt = null);
}
function Fl() {
  Po(), Ct.forEach(function(s) {
    return s.__resetIsScrolling();
  });
}
function Nl() {
  zt && Wt(zt);
  var s = 0;
  Ct.forEach(function(i) {
    s = Math.max(s, i.props.scrollingResetTimeInterval);
  }), zt = dr(Fl, s);
}
function Mo(s) {
  s.currentTarget === window && Qt == null && document.body && (Qt = document.body.style.pointerEvents, document.body.style.pointerEvents = "none"), Nl(), Ct.forEach(function(i) {
    i.props.scrollElement === s.currentTarget && i.__handleWindowScrollEvent();
  });
}
function Mi(s, i) {
  Ct.some(function(r) {
    return r.props.scrollElement === i;
  }) || i.addEventListener("scroll", Mo), Ct.push(s);
}
function Ai(s, i) {
  Ct = Ct.filter(function(r) {
    return r !== s;
  }), Ct.length || (i.removeEventListener("scroll", Mo), zt && (Wt(zt), Po()));
}
var gr = function(i) {
  return i === window;
}, Kt = function(i) {
  return i.getBoundingClientRect();
};
function ki(s, i) {
  if (s)
    if (gr(s)) {
      var r = window, e = r.innerHeight, a = r.innerWidth;
      return {
        height: typeof e == "number" ? e : 0,
        width: typeof a == "number" ? a : 0
      };
    } else
      return Kt(s);
  else return {
    height: i.serverHeight,
    width: i.serverWidth
  };
}
function Hl(s, i) {
  if (gr(i) && document.documentElement) {
    var r = document.documentElement, e = Kt(s), a = Kt(r);
    return {
      top: e.top - a.top,
      left: e.left - a.left
    };
  } else {
    var c = Ao(i), u = Kt(s), h = Kt(i);
    return {
      top: u.top + c.top - h.top,
      left: u.left + c.left - h.left
    };
  }
}
function Ao(s) {
  return gr(s) && document.documentElement ? {
    top: "scrollY" in window ? window.scrollY : document.documentElement.scrollTop,
    left: "scrollX" in window ? window.scrollX : document.documentElement.scrollLeft
  } : {
    top: s.scrollTop,
    left: s.scrollLeft
  };
}
function Di(s, i) {
  var r = Object.keys(s);
  if (Object.getOwnPropertySymbols) {
    var e = Object.getOwnPropertySymbols(s);
    i && (e = e.filter(function(a) {
      return Object.getOwnPropertyDescriptor(s, a).enumerable;
    })), r.push.apply(r, e);
  }
  return r;
}
function Li(s) {
  for (var i = 1; i < arguments.length; i++) {
    var r = arguments[i] != null ? arguments[i] : {};
    i % 2 ? Di(Object(r), !0).forEach(function(e) {
      O(s, e, r[e]);
    }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(s, Object.getOwnPropertyDescriptors(r)) : Di(Object(r)).forEach(function(e) {
      Object.defineProperty(s, e, Object.getOwnPropertyDescriptor(r, e));
    });
  }
  return s;
}
function $l(s, i, r) {
  return i = ze(i), Xe(s, ko() ? Reflect.construct(i, r || [], ze(s).constructor) : i.apply(s, r));
}
function ko() {
  try {
    var s = !Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function() {
    }));
  } catch {
  }
  return (ko = function() {
    return !!s;
  })();
}
var Ul = 150, Do = function() {
  return typeof window < "u" ? window : void 0;
}, Bl = /* @__PURE__ */ (function(s) {
  function i() {
    var r;
    Ge(this, i);
    for (var e = arguments.length, a = new Array(e), c = 0; c < e; c++)
      a[c] = arguments[c];
    return r = $l(this, i, [].concat(a)), O(r, "_window", Do()), O(r, "_isMounted", !1), O(r, "_positionFromTop", 0), O(r, "_positionFromLeft", 0), O(r, "_detectElementResize", void 0), O(r, "_child", void 0), O(r, "_windowScrollerRef", /* @__PURE__ */ le.createRef()), O(r, "state", Li(Li({}, ki(r.props.scrollElement, r.props)), {}, {
      isScrolling: !1,
      scrollLeft: 0,
      scrollTop: 0
    })), O(r, "_registerChild", function(u) {
      u && !(u instanceof Element) && console.warn("WindowScroller registerChild expects to be passed Element or null"), r._child = u, r.updatePosition();
    }), O(r, "_onChildScroll", function(u) {
      var h = u.scrollTop;
      if (r.state.scrollTop !== h) {
        var v = r.props.scrollElement;
        v && (typeof v.scrollTo == "function" ? v.scrollTo(0, h + r._positionFromTop) : v.scrollTop = h + r._positionFromTop);
      }
    }), O(r, "_registerResizeListener", function(u) {
      u === window ? window.addEventListener("resize", r._onResize, !1) : r._detectElementResize.addResizeListener(u, r._onResize);
    }), O(r, "_unregisterResizeListener", function(u) {
      u === window ? window.removeEventListener("resize", r._onResize, !1) : u && r._detectElementResize.removeResizeListener(u, r._onResize);
    }), O(r, "_onResize", function() {
      r.updatePosition();
    }), O(r, "__handleWindowScrollEvent", function() {
      if (r._isMounted) {
        var u = r.props.onScroll, h = r.props.scrollElement;
        if (h) {
          var v = Ao(h), m = Math.max(0, v.left - r._positionFromLeft), S = Math.max(0, v.top - r._positionFromTop);
          r.setState({
            isScrolling: !0,
            scrollLeft: m,
            scrollTop: S
          }), u({
            scrollLeft: m,
            scrollTop: S
          });
        }
      }
    }), O(r, "__resetIsScrolling", function() {
      r.setState({
        isScrolling: !1
      });
    }), r;
  }
  return Ye(i, s), We(i, [{
    key: "updatePosition",
    value: function() {
      var e = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : this.props.scrollElement, a = this.props.onResize, c = this.state, u = c.height, h = c.width, v = this._child || this._windowScrollerRef.current;
      if (v instanceof Element && e) {
        var m = Hl(v, e);
        this._positionFromTop = m.top, this._positionFromLeft = m.left;
      }
      var S = ki(e, this.props);
      (u !== S.height || h !== S.width) && (this.setState({
        height: S.height,
        width: S.width
      }), a({
        height: S.height,
        width: S.width
      })), this.props.updateScrollTopOnUpdatePosition === !0 && (this.__handleWindowScrollEvent(), this.__resetIsScrolling());
    }
  }, {
    key: "componentDidMount",
    value: function() {
      var e = this.props.scrollElement;
      this._detectElementResize = Qi(), this.updatePosition(e), e && (Mi(this, e), this._registerResizeListener(e)), this._isMounted = !0;
    }
  }, {
    key: "componentDidUpdate",
    value: function(e, a) {
      var c = this.props.scrollElement, u = e.scrollElement;
      u !== c && u != null && c != null && (this.updatePosition(c), Ai(this, u), Mi(this, c), this._unregisterResizeListener(u), this._registerResizeListener(c));
    }
  }, {
    key: "componentWillUnmount",
    value: function() {
      var e = this.props.scrollElement;
      e && (Ai(this, e), this._unregisterResizeListener(e)), this._isMounted = !1;
    }
  }, {
    key: "render",
    value: function() {
      var e = this.props.children, a = this.state, c = a.isScrolling, u = a.scrollTop, h = a.scrollLeft, v = a.height, m = a.width;
      return /* @__PURE__ */ le.createElement("div", {
        ref: this._windowScrollerRef
      }, e({
        onChildScroll: this._onChildScroll,
        registerChild: this._registerChild,
        height: v,
        isScrolling: c,
        scrollLeft: h,
        scrollTop: u,
        width: m
      }));
    }
  }]);
})(le.PureComponent);
O(Bl, "defaultProps", {
  onResize: function() {
  },
  onScroll: function() {
  },
  scrollingResetTimeInterval: Ul,
  scrollElement: Do(),
  serverHeight: 0,
  serverWidth: 0
});
const tr = "timeline-editor", ql = 0, Gi = 1, Vl = 10, Wi = 160, Lo = 20, nr = 1, rr = 8, ji = 32, ir = 20, Go = 5, Fi = {
  VERBOSE: 0,
  LOG: 1,
  INFO: 2,
  WARN: 3,
  ERROR: 4,
  SILENT: 1 / 0
  /* SILENT */
};
function Dt(s, i) {
  return `color:${s};font-size:${i}px;`;
}
class wn {
  static instances = [];
  static level = 1;
  static Levels = Fi;
  static noColor = !1;
  Levels = Fi;
  level = 1;
  prefix = "";
  enabled = !0;
  debugColor = Dt("#cccccc", 12);
  logColor = Dt("#bbbbbb", 12);
  infoColor = Dt("#2196f3", 12);
  warnColor = Dt("#ff00ff", 12);
  errorColor = Dt("#e91e63", 12);
  fatalColor = Dt("#9a0101", 13);
  /**
   * ConsoleLogger
   * @param   {string}  prefix  Logger prefix
   * @return  {ConsoleLogger}
   */
  constructor(i) {
    this.setPrefix(i), this.level = wn.level, wn.instances.push(this);
  }
  static setLevel(i) {
    this.level = i, this.instances.forEach((r) => r.setLevel(i));
  }
  static enable(i) {
    i && (this.level = i), this.instances.forEach((r) => r.enable());
  }
  static disable() {
    this.instances.forEach((i) => i.disable());
  }
  /**
   * set logger prefix
   * @param prefix
   */
  setPrefix(i) {
    this.prefix = i;
  }
  /**
   * enable logger with optional log level
   * @param level
   */
  enable(i = this.level) {
    this.level = i, this.enabled = !0;
  }
  /**
   * disable logger
   */
  disable() {
    this.enabled = !1;
  }
  /**
   * Set log level
   * @param   {LogLevel}  level
   * @return  {void}
   */
  setLevel(i) {
    this.level = i;
  }
  /**
   * trace
   * @param title
   * @param args
   */
  trace(i, ...r) {
    !this.enabled || this.level > 0 || console.trace(`%c[${this.prefix}] ${i}`, this.debugColor, ...r);
  }
  /**
   * debug
   * @param title
   * @param args
   */
  debug(i, ...r) {
    !this.enabled || this.level > 0 || console.debug(`%c[${this.prefix}] ${i}`, this.debugColor, ...r);
  }
  /**
   * log
   * @param title
   * @param args
   */
  log(i, ...r) {
    !this.enabled || this.level > 1 || console.log(`%c[${this.prefix}] ${i}`, this.logColor, ...r);
  }
  /**
   * info
   * @param title
   * @param args
   */
  info(i, ...r) {
    !this.enabled || this.level > 2 || console.info(`%c[${this.prefix}] ${i}`, this.infoColor, ...r);
  }
  /**
   * warn
   * @param title
   * @param args
   */
  warn(i, ...r) {
    !this.enabled || this.level > 3 || console.warn(`%c[${this.prefix}] ${i}`, this.warnColor, ...r);
  }
  /**
   * error
   * @param title
   * @param args
   */
  error(i, ...r) {
    !this.enabled || this.level > 4 || console.error(`%c[${this.prefix}] ${i}`, this.errorColor, ...r);
  }
  /**
   * fatal error
   * @param title
   * @param args
   */
  fatal(i, ...r) {
    !this.enabled || this.level > 5 || console.error(`%c[${this.prefix}] ${i}`, this.fatalColor, ...r);
  }
  /**
   * start a group with label
   * @param label
   */
  group(...i) {
    console.group && console.group(...i);
  }
  /**
   * end a group
   */
  groupEnd() {
    console.groupEnd && console.groupEnd();
  }
  /**
   * collapse log group
   * @param label
   */
  groupCollapsed(...i) {
    console.groupCollapsed && console.groupCollapsed(...i);
  }
}
const bt = new wn("timeline");
function Xl(s) {
  let {
    editorData: i = [],
    effects: r = {},
    scrollTop: e = 0,
    scale: a = Gi,
    scaleSplitCount: c = Vl,
    scaleWidth: u = Wi,
    startLeft: h = Lo,
    minScaleCount: v = ir,
    maxScaleCount: m = 1 / 0,
    rowHeight: S = ji
  } = s;
  a <= 0 && (bt.error("Error: scale must be greater than 0!"), a = Gi), e < 0 && (bt.warn("Warning: scrollTop cannot be less than 0!"), e = 0), c <= 0 && (bt.warn("Warning: scaleSplitCount cannot be less than 1!"), c = 1), u <= 0 && (bt.warn("Warning: scaleWidth must be greater than 0!"), u = Wi), h < 0 && (bt.warn("Warning: startLeft cannot be less than 0!"), h = 0), v < 1 && (bt.warn("Warning: minScaleCount must be greater than 1!"), v = ir), v = parseInt(v + ""), m < v && (bt.warn("Warning: maxScaleCount cannot be less than minScaleCount!"), m = v), m = m === 1 / 0 ? 1 / 0 : parseInt(m + ""), S <= 0 && (bt.warn("Warning: rowHeight must be greater than 0!"), S = ji);
  const b = { ...s };
  return delete b.style, {
    ...b,
    editorData: i,
    effects: r,
    scrollTop: e,
    scale: a,
    scaleSplitCount: c,
    scaleWidth: u,
    startLeft: h,
    minScaleCount: v,
    maxScaleCount: m,
    rowHeight: S
  };
}
function ct(s, i) {
  const { startLeft: r, scale: e, scaleWidth: a } = i;
  return r + s / e * a;
}
function Pt(s, i) {
  const { startLeft: r, scale: e, scaleWidth: a } = i;
  return (s - r) / a * e;
}
function Xt(s, i) {
  const { left: r, width: e } = s, a = Pt(r, i), c = Pt(r + e, i);
  return {
    start: a,
    end: c
  };
}
function or(s, i) {
  const { start: r, end: e } = s, a = ct(r, i), c = ct(e, i) - a;
  return {
    left: a,
    width: c
  };
}
function Yl(s, i) {
  let r = 0;
  return s.forEach((a) => {
    a.actions.forEach((c) => {
      r = Math.max(r, c.end);
    });
  }), Math.ceil(r / i.scale) + Go;
}
function Kl(s, i) {
  const { startLeft: r, scaleWidth: e } = i, a = Math.ceil((s - r) / e);
  return Math.max(a + Go, i.scaleCount);
}
function Zl(s, i) {
  const r = [];
  return s.forEach((e) => {
    r.push(ct(e.start, i)), r.push(ct(e.end, i));
  }), r;
}
function Ql(s) {
  for (var i = [], r = 1; r < arguments.length; r++)
    i[r - 1] = arguments[r];
  return i.map(function(e) {
    return e.split(" ").map(function(a) {
      return a ? "" + s + a : "";
    }).join(" ");
  }).join(" ");
}
function je(...s) {
  return Ql(`${tr}-`, ...s);
}
const Sn = 1, Ni = 3, Hi = 10;
function Jl(s) {
  const i = Ae(Number.MIN_SAFE_INTEGER), r = Ae(Number.MAX_SAFE_INTEGER), e = Ae(Sn), a = Ae();
  return {
    initAutoScroll: () => {
      if (s?.current) {
        const { left: m, width: S } = s.current.getBoundingClientRect();
        i.current = m, r.current = m + S;
      }
    },
    dealDragAutoScroll: (m, S) => {
      if (m.clientX >= r.current || m.clientX <= i.current) {
        a.current && cancelAnimationFrame(a.current);
        const b = Math.abs(m.clientX >= r.current ? m.clientX - r.current : m.clientX - i.current);
        e.current = Math.min(Number((b / Hi).toFixed(0)) * Sn, Ni);
        const R = (m.clientX >= r.current ? 1 : -1) * e.current, z = () => {
          S && S(R), a.current = requestAnimationFrame(z);
        };
        return a.current = requestAnimationFrame(z), !1;
      } else
        a.current && cancelAnimationFrame(a.current);
      return !0;
    },
    dealResizeAutoScroll: (m, S, b) => {
      if (m.clientX >= r.current || m.clientX < i.current) {
        a.current && cancelAnimationFrame(a.current);
        const C = Math.abs(m.clientX >= r.current ? m.clientX - r.current : m.clientX - i.current);
        e.current = Math.min(Number((C / Hi).toFixed(0)) * Sn, Ni);
        const z = (m.clientX >= r.current ? 1 : -1) * e.current, E = () => {
          b && b(z), a.current = requestAnimationFrame(E);
        };
        return a.current = requestAnimationFrame(E), !1;
      } else
        a.current && cancelAnimationFrame(a.current);
      return !0;
    },
    stopAutoScroll: () => {
      i.current = Number.MIN_SAFE_INTEGER, r.current = Number.MAX_SAFE_INTEGER, e.current = Sn, a.current && cancelAnimationFrame(a.current);
    }
  };
}
var Zt = { exports: {} }, ec = Zt.exports, $i;
function tc() {
  return $i || ($i = 1, (function(s, i) {
    (function(r, e) {
      s.exports = e();
    })(ec, (function() {
      function r(n, t) {
        var o = Object.keys(n);
        if (Object.getOwnPropertySymbols) {
          var l = Object.getOwnPropertySymbols(n);
          t && (l = l.filter((function(d) {
            return Object.getOwnPropertyDescriptor(n, d).enumerable;
          }))), o.push.apply(o, l);
        }
        return o;
      }
      function e(n) {
        for (var t = 1; t < arguments.length; t++) {
          var o = arguments[t] != null ? arguments[t] : {};
          t % 2 ? r(Object(o), !0).forEach((function(l) {
            v(n, l, o[l]);
          })) : Object.getOwnPropertyDescriptors ? Object.defineProperties(n, Object.getOwnPropertyDescriptors(o)) : r(Object(o)).forEach((function(l) {
            Object.defineProperty(n, l, Object.getOwnPropertyDescriptor(o, l));
          }));
        }
        return n;
      }
      function a(n) {
        return a = typeof Symbol == "function" && typeof Symbol.iterator == "symbol" ? function(t) {
          return typeof t;
        } : function(t) {
          return t && typeof Symbol == "function" && t.constructor === Symbol && t !== Symbol.prototype ? "symbol" : typeof t;
        }, a(n);
      }
      function c(n, t) {
        if (!(n instanceof t)) throw new TypeError("Cannot call a class as a function");
      }
      function u(n, t) {
        for (var o = 0; o < t.length; o++) {
          var l = t[o];
          l.enumerable = l.enumerable || !1, l.configurable = !0, "value" in l && (l.writable = !0), Object.defineProperty(n, E(l.key), l);
        }
      }
      function h(n, t, o) {
        return t && u(n.prototype, t), Object.defineProperty(n, "prototype", { writable: !1 }), n;
      }
      function v(n, t, o) {
        return (t = E(t)) in n ? Object.defineProperty(n, t, { value: o, enumerable: !0, configurable: !0, writable: !0 }) : n[t] = o, n;
      }
      function m(n, t) {
        if (typeof t != "function" && t !== null) throw new TypeError("Super expression must either be null or a function");
        n.prototype = Object.create(t && t.prototype, { constructor: { value: n, writable: !0, configurable: !0 } }), Object.defineProperty(n, "prototype", { writable: !1 }), t && b(n, t);
      }
      function S(n) {
        return S = Object.setPrototypeOf ? Object.getPrototypeOf.bind() : function(t) {
          return t.__proto__ || Object.getPrototypeOf(t);
        }, S(n);
      }
      function b(n, t) {
        return b = Object.setPrototypeOf ? Object.setPrototypeOf.bind() : function(o, l) {
          return o.__proto__ = l, o;
        }, b(n, t);
      }
      function C(n) {
        if (n === void 0) throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
        return n;
      }
      function R(n) {
        var t = (function() {
          if (typeof Reflect > "u" || !Reflect.construct || Reflect.construct.sham) return !1;
          if (typeof Proxy == "function") return !0;
          try {
            return Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], (function() {
            }))), !0;
          } catch {
            return !1;
          }
        })();
        return function() {
          var o, l = S(n);
          if (t) {
            var d = S(this).constructor;
            o = Reflect.construct(l, arguments, d);
          } else o = l.apply(this, arguments);
          return (function(f, p) {
            if (p && (typeof p == "object" || typeof p == "function")) return p;
            if (p !== void 0) throw new TypeError("Derived constructors may only return object or undefined");
            return C(f);
          })(this, o);
        };
      }
      function z() {
        return z = typeof Reflect < "u" && Reflect.get ? Reflect.get.bind() : function(n, t, o) {
          var l = (function(f, p) {
            for (; !Object.prototype.hasOwnProperty.call(f, p) && (f = S(f)) !== null; ) ;
            return f;
          })(n, t);
          if (l) {
            var d = Object.getOwnPropertyDescriptor(l, t);
            return d.get ? d.get.call(arguments.length < 3 ? n : o) : d.value;
          }
        }, z.apply(this, arguments);
      }
      function E(n) {
        var t = (function(o, l) {
          if (typeof o != "object" || o === null) return o;
          var d = o[Symbol.toPrimitive];
          if (d !== void 0) {
            var f = d.call(o, l);
            if (typeof f != "object") return f;
            throw new TypeError("@@toPrimitive must return a primitive value.");
          }
          return String(o);
        })(n, "string");
        return typeof t == "symbol" ? t : t + "";
      }
      var k = function(n) {
        return !(!n || !n.Window) && n instanceof n.Window;
      }, L = void 0, q = void 0;
      function P(n) {
        L = n;
        var t = n.document.createTextNode("");
        t.ownerDocument !== n.document && typeof n.wrap == "function" && n.wrap(t) === t && (n = n.wrap(n)), q = n;
      }
      function W(n) {
        return k(n) ? n : (n.ownerDocument || n).defaultView || q.window;
      }
      typeof window < "u" && window && P(window);
      var I = function(n) {
        return !!n && a(n) === "object";
      }, V = function(n) {
        return typeof n == "function";
      }, x = { window: function(n) {
        return n === q || k(n);
      }, docFrag: function(n) {
        return I(n) && n.nodeType === 11;
      }, object: I, func: V, number: function(n) {
        return typeof n == "number";
      }, bool: function(n) {
        return typeof n == "boolean";
      }, string: function(n) {
        return typeof n == "string";
      }, element: function(n) {
        if (!n || a(n) !== "object") return !1;
        var t = W(n) || q;
        return /object|function/.test(typeof Element > "u" ? "undefined" : a(Element)) ? n instanceof Element || n instanceof t.Element : n.nodeType === 1 && typeof n.nodeName == "string";
      }, plainObject: function(n) {
        return I(n) && !!n.constructor && /function Object\b/.test(n.constructor.toString());
      }, array: function(n) {
        return I(n) && n.length !== void 0 && V(n.splice);
      } };
      function j(n) {
        var t = n.interaction;
        if (t.prepared.name === "drag") {
          var o = t.prepared.axis;
          o === "x" ? (t.coords.cur.page.y = t.coords.start.page.y, t.coords.cur.client.y = t.coords.start.client.y, t.coords.velocity.client.y = 0, t.coords.velocity.page.y = 0) : o === "y" && (t.coords.cur.page.x = t.coords.start.page.x, t.coords.cur.client.x = t.coords.start.client.x, t.coords.velocity.client.x = 0, t.coords.velocity.page.x = 0);
        }
      }
      function ie(n) {
        var t = n.iEvent, o = n.interaction;
        if (o.prepared.name === "drag") {
          var l = o.prepared.axis;
          if (l === "x" || l === "y") {
            var d = l === "x" ? "y" : "x";
            t.page[d] = o.coords.start.page[d], t.client[d] = o.coords.start.client[d], t.delta[d] = 0;
          }
        }
      }
      var te = { id: "actions/drag", install: function(n) {
        var t = n.actions, o = n.Interactable, l = n.defaults;
        o.prototype.draggable = te.draggable, t.map.drag = te, t.methodDict.drag = "draggable", l.actions.drag = te.defaults;
      }, listeners: { "interactions:before-action-move": j, "interactions:action-resume": j, "interactions:action-move": ie, "auto-start:check": function(n) {
        var t = n.interaction, o = n.interactable, l = n.buttons, d = o.options.drag;
        if (d && d.enabled && (!t.pointerIsDown || !/mouse|pointer/.test(t.pointerType) || (l & o.options.drag.mouseButtons) != 0)) return n.action = { name: "drag", axis: d.lockAxis === "start" ? d.startAxis : d.lockAxis }, !1;
      } }, draggable: function(n) {
        return x.object(n) ? (this.options.drag.enabled = n.enabled !== !1, this.setPerAction("drag", n), this.setOnEvents("drag", n), /^(xy|x|y|start)$/.test(n.lockAxis) && (this.options.drag.lockAxis = n.lockAxis), /^(xy|x|y)$/.test(n.startAxis) && (this.options.drag.startAxis = n.startAxis), this) : x.bool(n) ? (this.options.drag.enabled = n, this) : this.options.drag;
      }, beforeMove: j, move: ie, defaults: { startAxis: "xy", lockAxis: "xy" }, getCursor: function() {
        return "move";
      }, filterEventType: function(n) {
        return n.search("drag") === 0;
      } }, Q = te, ce = { init: function(n) {
        var t = n;
        ce.document = t.document, ce.DocumentFragment = t.DocumentFragment || de, ce.SVGElement = t.SVGElement || de, ce.SVGSVGElement = t.SVGSVGElement || de, ce.SVGElementInstance = t.SVGElementInstance || de, ce.Element = t.Element || de, ce.HTMLElement = t.HTMLElement || ce.Element, ce.Event = t.Event, ce.Touch = t.Touch || de, ce.PointerEvent = t.PointerEvent || t.MSPointerEvent;
      }, document: null, DocumentFragment: null, SVGElement: null, SVGSVGElement: null, SVGElementInstance: null, Element: null, HTMLElement: null, Event: null, Touch: null, PointerEvent: null };
      function de() {
      }
      var he = ce, pe = { init: function(n) {
        var t = he.Element, o = n.navigator || {};
        pe.supportsTouch = "ontouchstart" in n || x.func(n.DocumentTouch) && he.document instanceof n.DocumentTouch, pe.supportsPointerEvent = o.pointerEnabled !== !1 && !!he.PointerEvent, pe.isIOS = /iP(hone|od|ad)/.test(o.platform), pe.isIOS7 = /iP(hone|od|ad)/.test(o.platform) && /OS 7[^\d]/.test(o.appVersion), pe.isIe9 = /MSIE 9/.test(o.userAgent), pe.isOperaMobile = o.appName === "Opera" && pe.supportsTouch && /Presto/.test(o.userAgent), pe.prefixedMatchesSelector = "matches" in t.prototype ? "matches" : "webkitMatchesSelector" in t.prototype ? "webkitMatchesSelector" : "mozMatchesSelector" in t.prototype ? "mozMatchesSelector" : "oMatchesSelector" in t.prototype ? "oMatchesSelector" : "msMatchesSelector", pe.pEventTypes = pe.supportsPointerEvent ? he.PointerEvent === n.MSPointerEvent ? { up: "MSPointerUp", down: "MSPointerDown", over: "mouseover", out: "mouseout", move: "MSPointerMove", cancel: "MSPointerCancel" } : { up: "pointerup", down: "pointerdown", over: "pointerover", out: "pointerout", move: "pointermove", cancel: "pointercancel" } : null, pe.wheelEvent = he.document && "onmousewheel" in he.document ? "mousewheel" : "wheel";
      }, supportsTouch: null, supportsPointerEvent: null, isIOS7: null, isIOS: null, isIe9: null, isOperaMobile: null, prefixedMatchesSelector: null, pEventTypes: null, wheelEvent: null }, Se = pe;
      function Te(n, t) {
        if (n.contains) return n.contains(t);
        for (; t; ) {
          if (t === n) return !0;
          t = t.parentNode;
        }
        return !1;
      }
      function Fe(n, t) {
        for (; x.element(n); ) {
          if (G(n, t)) return n;
          n = Re(n);
        }
        return null;
      }
      function Re(n) {
        var t = n.parentNode;
        if (x.docFrag(t)) {
          for (; (t = t.host) && x.docFrag(t); ) ;
          return t;
        }
        return t;
      }
      function G(n, t) {
        return q !== L && (t = t.replace(/\/deep\//g, " ")), n[Se.prefixedMatchesSelector](t);
      }
      var F = function(n) {
        return n.parentNode || n.host;
      };
      function oe(n, t) {
        for (var o, l = [], d = n; (o = F(d)) && d !== t && o !== d.ownerDocument; ) l.unshift(d), d = o;
        return l;
      }
      function U(n, t, o) {
        for (; x.element(n); ) {
          if (G(n, t)) return !0;
          if ((n = Re(n)) === o) return G(n, t);
        }
        return !1;
      }
      function X(n) {
        return n.correspondingUseElement || n;
      }
      function Y(n) {
        var t = n instanceof he.SVGElement ? n.getBoundingClientRect() : n.getClientRects()[0];
        return t && { left: t.left, right: t.right, top: t.top, bottom: t.bottom, width: t.width || t.right - t.left, height: t.height || t.bottom - t.top };
      }
      function Z(n) {
        var t, o = Y(n);
        if (!Se.isIOS7 && o) {
          var l = { x: (t = (t = W(n)) || q).scrollX || t.document.documentElement.scrollLeft, y: t.scrollY || t.document.documentElement.scrollTop };
          o.left += l.x, o.right += l.x, o.top += l.y, o.bottom += l.y;
        }
        return o;
      }
      function ne(n) {
        for (var t = []; n; ) t.push(n), n = Re(n);
        return t;
      }
      function fe(n) {
        return !!x.string(n) && (he.document.querySelector(n), !0);
      }
      function A(n, t) {
        for (var o in t) n[o] = t[o];
        return n;
      }
      function se(n, t, o) {
        return n === "parent" ? Re(o) : n === "self" ? t.getRect(o) : Fe(o, n);
      }
      function Ce(n, t, o, l) {
        var d = n;
        return x.string(d) ? d = se(d, t, o) : x.func(d) && (d = d.apply(void 0, l)), x.element(d) && (d = Z(d)), d;
      }
      function H(n) {
        return n && { x: "x" in n ? n.x : n.left, y: "y" in n ? n.y : n.top };
      }
      function J(n) {
        return !n || "x" in n && "y" in n || ((n = A({}, n)).x = n.left || 0, n.y = n.top || 0, n.width = n.width || (n.right || 0) - n.x, n.height = n.height || (n.bottom || 0) - n.y), n;
      }
      function re(n, t, o) {
        n.left && (t.left += o.x), n.right && (t.right += o.x), n.top && (t.top += o.y), n.bottom && (t.bottom += o.y), t.width = t.right - t.left, t.height = t.bottom - t.top;
      }
      function ue(n, t, o) {
        var l = o && n.options[o];
        return H(Ce(l && l.origin || n.options.origin, n, t, [n && t])) || { x: 0, y: 0 };
      }
      function me(n, t) {
        var o = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : function(y) {
          return !0;
        }, l = arguments.length > 3 ? arguments[3] : void 0;
        if (l = l || {}, x.string(n) && n.search(" ") !== -1 && (n = ve(n)), x.array(n)) return n.forEach((function(y) {
          return me(y, t, o, l);
        })), l;
        if (x.object(n) && (t = n, n = ""), x.func(t) && o(n)) l[n] = l[n] || [], l[n].push(t);
        else if (x.array(t)) for (var d = 0, f = t; d < f.length; d++) {
          var p = f[d];
          me(n, p, o, l);
        }
        else if (x.object(t)) for (var g in t)
          me(ve(g).map((function(y) {
            return "".concat(n).concat(y);
          })), t[g], o, l);
        return l;
      }
      function ve(n) {
        return n.trim().split(/ +/);
      }
      var Ne = function(n, t) {
        return Math.sqrt(n * n + t * t);
      }, gt = ["webkit", "moz"];
      function we(n, t) {
        n.__set || (n.__set = {});
        var o = function(d) {
          if (gt.some((function(f) {
            return d.indexOf(f) === 0;
          }))) return 1;
          typeof n[d] != "function" && d !== "__set" && Object.defineProperty(n, d, { get: function() {
            return d in n.__set ? n.__set[d] : n.__set[d] = t[d];
          }, set: function(f) {
            n.__set[d] = f;
          }, configurable: !0 });
        };
        for (var l in t) o(l);
        return n;
      }
      function Ie(n, t) {
        n.page = n.page || {}, n.page.x = t.page.x, n.page.y = t.page.y, n.client = n.client || {}, n.client.x = t.client.x, n.client.y = t.client.y, n.timeStamp = t.timeStamp;
      }
      function De(n) {
        n.page.x = 0, n.page.y = 0, n.client.x = 0, n.client.y = 0;
      }
      function He(n) {
        return n instanceof he.Event || n instanceof he.Touch;
      }
      function $e(n, t, o) {
        return n = n || "page", (o = o || {}).x = t[n + "X"], o.y = t[n + "Y"], o;
      }
      function Ke(n, t) {
        return t = t || { x: 0, y: 0 }, Se.isOperaMobile && He(n) ? ($e("screen", n, t), t.x += window.scrollX, t.y += window.scrollY) : $e("page", n, t), t;
      }
      function Le(n) {
        return x.number(n.pointerId) ? n.pointerId : n.identifier;
      }
      function Ue(n, t, o) {
        var l = t.length > 1 ? ut(t) : t[0];
        Ke(l, n.page), (function(d, f) {
          f = f || {}, Se.isOperaMobile && He(d) ? $e("screen", d, f) : $e("client", d, f);
        })(l, n.client), n.timeStamp = o;
      }
      function it(n) {
        var t = [];
        return x.array(n) ? (t[0] = n[0], t[1] = n[1]) : n.type === "touchend" ? n.touches.length === 1 ? (t[0] = n.touches[0], t[1] = n.changedTouches[0]) : n.touches.length === 0 && (t[0] = n.changedTouches[0], t[1] = n.changedTouches[1]) : (t[0] = n.touches[0], t[1] = n.touches[1]), t;
      }
      function ut(n) {
        for (var t = { pageX: 0, pageY: 0, clientX: 0, clientY: 0, screenX: 0, screenY: 0 }, o = 0; o < n.length; o++) {
          var l = n[o];
          for (var d in t) t[d] += l[d];
        }
        for (var f in t) t[f] /= n.length;
        return t;
      }
      function ot(n) {
        if (!n.length) return null;
        var t = it(n), o = Math.min(t[0].pageX, t[1].pageX), l = Math.min(t[0].pageY, t[1].pageY), d = Math.max(t[0].pageX, t[1].pageX), f = Math.max(t[0].pageY, t[1].pageY);
        return { x: o, y: l, left: o, top: l, right: d, bottom: f, width: d - o, height: f - l };
      }
      function st(n, t) {
        var o = t + "X", l = t + "Y", d = it(n), f = d[0][o] - d[1][o], p = d[0][l] - d[1][l];
        return Ne(f, p);
      }
      function xt(n, t) {
        var o = t + "X", l = t + "Y", d = it(n), f = d[1][o] - d[0][o], p = d[1][l] - d[0][l];
        return 180 * Math.atan2(p, f) / Math.PI;
      }
      function mr(n) {
        return x.string(n.pointerType) ? n.pointerType : x.number(n.pointerType) ? [void 0, void 0, "touch", "pen", "mouse"][n.pointerType] : /touch/.test(n.type || "") || n instanceof he.Touch ? "touch" : "mouse";
      }
      function yr(n) {
        var t = x.func(n.composedPath) ? n.composedPath() : n.path;
        return [X(t ? t[0] : n.target), X(n.currentTarget)];
      }
      var on = (function() {
        function n(t) {
          c(this, n), this.immediatePropagationStopped = !1, this.propagationStopped = !1, this._interaction = t;
        }
        return h(n, [{ key: "preventDefault", value: function() {
        } }, { key: "stopPropagation", value: function() {
          this.propagationStopped = !0;
        } }, { key: "stopImmediatePropagation", value: function() {
          this.immediatePropagationStopped = this.propagationStopped = !0;
        } }]), n;
      })();
      Object.defineProperty(on.prototype, "interaction", { get: function() {
        return this._interaction._proxy;
      }, set: function() {
      } });
      var Sr = function(n, t) {
        for (var o = 0; o < t.length; o++) {
          var l = t[o];
          n.push(l);
        }
        return n;
      }, _r = function(n) {
        return Sr([], n);
      }, Ft = function(n, t) {
        for (var o = 0; o < n.length; o++) if (t(n[o], o, n)) return o;
        return -1;
      }, Nt = function(n, t) {
        return n[Ft(n, t)];
      }, Mt = (function(n) {
        m(o, n);
        var t = R(o);
        function o(l, d, f) {
          var p;
          c(this, o), (p = t.call(this, d._interaction)).dropzone = void 0, p.dragEvent = void 0, p.relatedTarget = void 0, p.draggable = void 0, p.propagationStopped = !1, p.immediatePropagationStopped = !1;
          var g = f === "dragleave" ? l.prev : l.cur, y = g.element, w = g.dropzone;
          return p.type = f, p.target = y, p.currentTarget = y, p.dropzone = w, p.dragEvent = d, p.relatedTarget = d.target, p.draggable = d.interactable, p.timeStamp = d.timeStamp, p;
        }
        return h(o, [{ key: "reject", value: function() {
          var l = this, d = this._interaction.dropState;
          if (this.type === "dropactivate" || this.dropzone && d.cur.dropzone === this.dropzone && d.cur.element === this.target) if (d.prev.dropzone = this.dropzone, d.prev.element = this.target, d.rejected = !0, d.events.enter = null, this.stopImmediatePropagation(), this.type === "dropactivate") {
            var f = d.activeDrops, p = Ft(f, (function(y) {
              var w = y.dropzone, _ = y.element;
              return w === l.dropzone && _ === l.target;
            }));
            d.activeDrops.splice(p, 1);
            var g = new o(d, this.dragEvent, "dropdeactivate");
            g.dropzone = this.dropzone, g.target = this.target, this.dropzone.fire(g);
          } else this.dropzone.fire(new o(d, this.dragEvent, "dragleave"));
        } }, { key: "preventDefault", value: function() {
        } }, { key: "stopPropagation", value: function() {
          this.propagationStopped = !0;
        } }, { key: "stopImmediatePropagation", value: function() {
          this.immediatePropagationStopped = this.propagationStopped = !0;
        } }]), o;
      })(on);
      function br(n, t) {
        for (var o = 0, l = n.slice(); o < l.length; o++) {
          var d = l[o], f = d.dropzone, p = d.element;
          t.dropzone = f, t.target = p, f.fire(t), t.propagationStopped = t.immediatePropagationStopped = !1;
        }
      }
      function xn(n, t) {
        for (var o = (function(f, p) {
          for (var g = [], y = 0, w = f.interactables.list; y < w.length; y++) {
            var _ = w[y];
            if (_.options.drop.enabled) {
              var T = _.options.drop.accept;
              if (!(x.element(T) && T !== p || x.string(T) && !G(p, T) || x.func(T) && !T({ dropzone: _, draggableElement: p }))) for (var M = 0, $ = _.getAllElements(); M < $.length; M++) {
                var N = $[M];
                N !== p && g.push({ dropzone: _, element: N, rect: _.getRect(N) });
              }
            }
          }
          return g;
        })(n, t), l = 0; l < o.length; l++) {
          var d = o[l];
          d.rect = d.dropzone.getRect(d.element);
        }
        return o;
      }
      function wr(n, t, o) {
        for (var l = n.dropState, d = n.interactable, f = n.element, p = [], g = 0, y = l.activeDrops; g < y.length; g++) {
          var w = y[g], _ = w.dropzone, T = w.element, M = w.rect, $ = _.dropCheck(t, o, d, f, T, M);
          p.push($ ? T : null);
        }
        var N = (function(B) {
          for (var ee, K, ae, _e = [], xe = 0; xe < B.length; xe++) {
            var ge = B[xe], be = B[ee];
            if (ge && xe !== ee) if (be) {
              var qe = F(ge), ke = F(be);
              if (qe !== ge.ownerDocument) if (ke !== ge.ownerDocument) if (qe !== ke) {
                _e = _e.length ? _e : oe(be);
                var et = void 0;
                if (be instanceof he.HTMLElement && ge instanceof he.SVGElement && !(ge instanceof he.SVGSVGElement)) {
                  if (ge === ke) continue;
                  et = ge.ownerSVGElement;
                } else et = ge;
                for (var nt = oe(et, be.ownerDocument), ht = 0; nt[ht] && nt[ht] === _e[ht]; ) ht++;
                var pn = [nt[ht - 1], nt[ht], _e[ht]];
                if (pn[0]) for (var Vt = pn[0].lastChild; Vt; ) {
                  if (Vt === pn[1]) {
                    ee = xe, _e = nt;
                    break;
                  }
                  if (Vt === pn[2]) break;
                  Vt = Vt.previousSibling;
                }
              } else ae = be, (parseInt(W(K = ge).getComputedStyle(K).zIndex, 10) || 0) >= (parseInt(W(ae).getComputedStyle(ae).zIndex, 10) || 0) && (ee = xe);
              else ee = xe;
            } else ee = xe;
          }
          return ee;
        })(p);
        return l.activeDrops[N] || null;
      }
      function Rn(n, t, o) {
        var l = n.dropState, d = { enter: null, leave: null, activate: null, deactivate: null, move: null, drop: null };
        return o.type === "dragstart" && (d.activate = new Mt(l, o, "dropactivate"), d.activate.target = null, d.activate.dropzone = null), o.type === "dragend" && (d.deactivate = new Mt(l, o, "dropdeactivate"), d.deactivate.target = null, d.deactivate.dropzone = null), l.rejected || (l.cur.element !== l.prev.element && (l.prev.dropzone && (d.leave = new Mt(l, o, "dragleave"), o.dragLeave = d.leave.target = l.prev.element, o.prevDropzone = d.leave.dropzone = l.prev.dropzone), l.cur.dropzone && (d.enter = new Mt(l, o, "dragenter"), o.dragEnter = l.cur.element, o.dropzone = l.cur.dropzone)), o.type === "dragend" && l.cur.dropzone && (d.drop = new Mt(l, o, "drop"), o.dropzone = l.cur.dropzone, o.relatedTarget = l.cur.element), o.type === "dragmove" && l.cur.dropzone && (d.move = new Mt(l, o, "dropmove"), o.dropzone = l.cur.dropzone)), d;
      }
      function Tn(n, t) {
        var o = n.dropState, l = o.activeDrops, d = o.cur, f = o.prev;
        t.leave && f.dropzone.fire(t.leave), t.enter && d.dropzone.fire(t.enter), t.move && d.dropzone.fire(t.move), t.drop && d.dropzone.fire(t.drop), t.deactivate && br(l, t.deactivate), o.prev.dropzone = d.dropzone, o.prev.element = d.element;
      }
      function Cr(n, t) {
        var o = n.interaction, l = n.iEvent, d = n.event;
        if (l.type === "dragmove" || l.type === "dragend") {
          var f = o.dropState;
          t.dynamicDrop && (f.activeDrops = xn(t, o.element));
          var p = l, g = wr(o, p, d);
          f.rejected = f.rejected && !!g && g.dropzone === f.cur.dropzone && g.element === f.cur.element, f.cur.dropzone = g && g.dropzone, f.cur.element = g && g.element, f.events = Rn(o, 0, p);
        }
      }
      var xr = { id: "actions/drop", install: function(n) {
        var t = n.actions, o = n.interactStatic, l = n.Interactable, d = n.defaults;
        n.usePlugin(Q), l.prototype.dropzone = function(f) {
          return (function(p, g) {
            if (x.object(g)) {
              if (p.options.drop.enabled = g.enabled !== !1, g.listeners) {
                var y = me(g.listeners), w = Object.keys(y).reduce((function(T, M) {
                  return T[/^(enter|leave)/.test(M) ? "drag".concat(M) : /^(activate|deactivate|move)/.test(M) ? "drop".concat(M) : M] = y[M], T;
                }), {}), _ = p.options.drop.listeners;
                _ && p.off(_), p.on(w), p.options.drop.listeners = w;
              }
              return x.func(g.ondrop) && p.on("drop", g.ondrop), x.func(g.ondropactivate) && p.on("dropactivate", g.ondropactivate), x.func(g.ondropdeactivate) && p.on("dropdeactivate", g.ondropdeactivate), x.func(g.ondragenter) && p.on("dragenter", g.ondragenter), x.func(g.ondragleave) && p.on("dragleave", g.ondragleave), x.func(g.ondropmove) && p.on("dropmove", g.ondropmove), /^(pointer|center)$/.test(g.overlap) ? p.options.drop.overlap = g.overlap : x.number(g.overlap) && (p.options.drop.overlap = Math.max(Math.min(1, g.overlap), 0)), "accept" in g && (p.options.drop.accept = g.accept), "checker" in g && (p.options.drop.checker = g.checker), p;
            }
            return x.bool(g) ? (p.options.drop.enabled = g, p) : p.options.drop;
          })(this, f);
        }, l.prototype.dropCheck = function(f, p, g, y, w, _) {
          return (function(T, M, $, N, B, ee, K) {
            var ae = !1;
            if (!(K = K || T.getRect(ee))) return !!T.options.drop.checker && T.options.drop.checker(M, $, ae, T, ee, N, B);
            var _e = T.options.drop.overlap;
            if (_e === "pointer") {
              var xe = ue(N, B, "drag"), ge = Ke(M);
              ge.x += xe.x, ge.y += xe.y;
              var be = ge.x > K.left && ge.x < K.right, qe = ge.y > K.top && ge.y < K.bottom;
              ae = be && qe;
            }
            var ke = N.getRect(B);
            if (ke && _e === "center") {
              var et = ke.left + ke.width / 2, nt = ke.top + ke.height / 2;
              ae = et >= K.left && et <= K.right && nt >= K.top && nt <= K.bottom;
            }
            return ke && x.number(_e) && (ae = Math.max(0, Math.min(K.right, ke.right) - Math.max(K.left, ke.left)) * Math.max(0, Math.min(K.bottom, ke.bottom) - Math.max(K.top, ke.top)) / (ke.width * ke.height) >= _e), T.options.drop.checker && (ae = T.options.drop.checker(M, $, ae, T, ee, N, B)), ae;
          })(this, f, p, g, y, w, _);
        }, o.dynamicDrop = function(f) {
          return x.bool(f) ? (n.dynamicDrop = f, o) : n.dynamicDrop;
        }, A(t.phaselessTypes, { dragenter: !0, dragleave: !0, dropactivate: !0, dropdeactivate: !0, dropmove: !0, drop: !0 }), t.methodDict.drop = "dropzone", n.dynamicDrop = !1, d.actions.drop = xr.defaults;
      }, listeners: { "interactions:before-action-start": function(n) {
        var t = n.interaction;
        t.prepared.name === "drag" && (t.dropState = { cur: { dropzone: null, element: null }, prev: { dropzone: null, element: null }, rejected: null, events: null, activeDrops: [] });
      }, "interactions:after-action-start": function(n, t) {
        var o = n.interaction, l = (n.event, n.iEvent);
        if (o.prepared.name === "drag") {
          var d = o.dropState;
          d.activeDrops = [], d.events = {}, d.activeDrops = xn(t, o.element), d.events = Rn(o, 0, l), d.events.activate && (br(d.activeDrops, d.events.activate), t.fire("actions/drop:start", { interaction: o, dragEvent: l }));
        }
      }, "interactions:action-move": Cr, "interactions:after-action-move": function(n, t) {
        var o = n.interaction, l = n.iEvent;
        if (o.prepared.name === "drag") {
          var d = o.dropState;
          Tn(o, d.events), t.fire("actions/drop:move", { interaction: o, dragEvent: l }), d.events = {};
        }
      }, "interactions:action-end": function(n, t) {
        if (n.interaction.prepared.name === "drag") {
          var o = n.interaction, l = n.iEvent;
          Cr(n, t), Tn(o, o.dropState.events), t.fire("actions/drop:end", { interaction: o, dragEvent: l });
        }
      }, "interactions:stop": function(n) {
        var t = n.interaction;
        if (t.prepared.name === "drag") {
          var o = t.dropState;
          o && (o.activeDrops = null, o.events = null, o.cur.dropzone = null, o.cur.element = null, o.prev.dropzone = null, o.prev.element = null, o.rejected = !1);
        }
      } }, getActiveDrops: xn, getDrop: wr, getDropEvents: Rn, fireDropEvents: Tn, filterEventType: function(n) {
        return n.search("drag") === 0 || n.search("drop") === 0;
      }, defaults: { enabled: !1, accept: null, overlap: "pointer" } }, jo = xr;
      function In(n) {
        var t = n.interaction, o = n.iEvent, l = n.phase;
        if (t.prepared.name === "gesture") {
          var d = t.pointers.map((function(w) {
            return w.pointer;
          })), f = l === "start", p = l === "end", g = t.interactable.options.deltaSource;
          if (o.touches = [d[0], d[1]], f) o.distance = st(d, g), o.box = ot(d), o.scale = 1, o.ds = 0, o.angle = xt(d, g), o.da = 0, t.gesture.startDistance = o.distance, t.gesture.startAngle = o.angle;
          else if (p || t.pointers.length < 2) {
            var y = t.prevEvent;
            o.distance = y.distance, o.box = y.box, o.scale = y.scale, o.ds = 0, o.angle = y.angle, o.da = 0;
          } else o.distance = st(d, g), o.box = ot(d), o.scale = o.distance / t.gesture.startDistance, o.angle = xt(d, g), o.ds = o.scale - t.gesture.scale, o.da = o.angle - t.gesture.angle;
          t.gesture.distance = o.distance, t.gesture.angle = o.angle, x.number(o.scale) && o.scale !== 1 / 0 && !isNaN(o.scale) && (t.gesture.scale = o.scale);
        }
      }
      var zn = { id: "actions/gesture", before: ["actions/drag", "actions/resize"], install: function(n) {
        var t = n.actions, o = n.Interactable, l = n.defaults;
        o.prototype.gesturable = function(d) {
          return x.object(d) ? (this.options.gesture.enabled = d.enabled !== !1, this.setPerAction("gesture", d), this.setOnEvents("gesture", d), this) : x.bool(d) ? (this.options.gesture.enabled = d, this) : this.options.gesture;
        }, t.map.gesture = zn, t.methodDict.gesture = "gesturable", l.actions.gesture = zn.defaults;
      }, listeners: { "interactions:action-start": In, "interactions:action-move": In, "interactions:action-end": In, "interactions:new": function(n) {
        n.interaction.gesture = { angle: 0, distance: 0, scale: 1, startAngle: 0, startDistance: 0 };
      }, "auto-start:check": function(n) {
        if (!(n.interaction.pointers.length < 2)) {
          var t = n.interactable.options.gesture;
          if (t && t.enabled) return n.action = { name: "gesture" }, !1;
        }
      } }, defaults: {}, getCursor: function() {
        return "";
      }, filterEventType: function(n) {
        return n.search("gesture") === 0;
      } }, Fo = zn;
      function No(n, t, o, l, d, f, p) {
        if (!t) return !1;
        if (t === !0) {
          var g = x.number(f.width) ? f.width : f.right - f.left, y = x.number(f.height) ? f.height : f.bottom - f.top;
          if (p = Math.min(p, Math.abs((n === "left" || n === "right" ? g : y) / 2)), g < 0 && (n === "left" ? n = "right" : n === "right" && (n = "left")), y < 0 && (n === "top" ? n = "bottom" : n === "bottom" && (n = "top")), n === "left") {
            var w = g >= 0 ? f.left : f.right;
            return o.x < w + p;
          }
          if (n === "top") {
            var _ = y >= 0 ? f.top : f.bottom;
            return o.y < _ + p;
          }
          if (n === "right") return o.x > (g >= 0 ? f.right : f.left) - p;
          if (n === "bottom") return o.y > (y >= 0 ? f.bottom : f.top) - p;
        }
        return !!x.element(l) && (x.element(t) ? t === l : U(l, t, d));
      }
      function Rr(n) {
        var t = n.iEvent, o = n.interaction;
        if (o.prepared.name === "resize" && o.resizeAxes) {
          var l = t;
          o.interactable.options.resize.square ? (o.resizeAxes === "y" ? l.delta.x = l.delta.y : l.delta.y = l.delta.x, l.axes = "xy") : (l.axes = o.resizeAxes, o.resizeAxes === "x" ? l.delta.y = 0 : o.resizeAxes === "y" && (l.delta.x = 0));
        }
      }
      var dt, Rt, ft = { id: "actions/resize", before: ["actions/drag"], install: function(n) {
        var t = n.actions, o = n.browser, l = n.Interactable, d = n.defaults;
        ft.cursors = (function(f) {
          return f.isIe9 ? { x: "e-resize", y: "s-resize", xy: "se-resize", top: "n-resize", left: "w-resize", bottom: "s-resize", right: "e-resize", topleft: "se-resize", bottomright: "se-resize", topright: "ne-resize", bottomleft: "ne-resize" } : { x: "ew-resize", y: "ns-resize", xy: "nwse-resize", top: "ns-resize", left: "ew-resize", bottom: "ns-resize", right: "ew-resize", topleft: "nwse-resize", bottomright: "nwse-resize", topright: "nesw-resize", bottomleft: "nesw-resize" };
        })(o), ft.defaultMargin = o.supportsTouch || o.supportsPointerEvent ? 20 : 10, l.prototype.resizable = function(f) {
          return (function(p, g, y) {
            return x.object(g) ? (p.options.resize.enabled = g.enabled !== !1, p.setPerAction("resize", g), p.setOnEvents("resize", g), x.string(g.axis) && /^x$|^y$|^xy$/.test(g.axis) ? p.options.resize.axis = g.axis : g.axis === null && (p.options.resize.axis = y.defaults.actions.resize.axis), x.bool(g.preserveAspectRatio) ? p.options.resize.preserveAspectRatio = g.preserveAspectRatio : x.bool(g.square) && (p.options.resize.square = g.square), p) : x.bool(g) ? (p.options.resize.enabled = g, p) : p.options.resize;
          })(this, f, n);
        }, t.map.resize = ft, t.methodDict.resize = "resizable", d.actions.resize = ft.defaults;
      }, listeners: { "interactions:new": function(n) {
        n.interaction.resizeAxes = "xy";
      }, "interactions:action-start": function(n) {
        (function(t) {
          var o = t.iEvent, l = t.interaction;
          if (l.prepared.name === "resize" && l.prepared.edges) {
            var d = o, f = l.rect;
            l._rects = { start: A({}, f), corrected: A({}, f), previous: A({}, f), delta: { left: 0, right: 0, width: 0, top: 0, bottom: 0, height: 0 } }, d.edges = l.prepared.edges, d.rect = l._rects.corrected, d.deltaRect = l._rects.delta;
          }
        })(n), Rr(n);
      }, "interactions:action-move": function(n) {
        (function(t) {
          var o = t.iEvent, l = t.interaction;
          if (l.prepared.name === "resize" && l.prepared.edges) {
            var d = o, f = l.interactable.options.resize.invert, p = f === "reposition" || f === "negate", g = l.rect, y = l._rects, w = y.start, _ = y.corrected, T = y.delta, M = y.previous;
            if (A(M, _), p) {
              if (A(_, g), f === "reposition") {
                if (_.top > _.bottom) {
                  var $ = _.top;
                  _.top = _.bottom, _.bottom = $;
                }
                if (_.left > _.right) {
                  var N = _.left;
                  _.left = _.right, _.right = N;
                }
              }
            } else _.top = Math.min(g.top, w.bottom), _.bottom = Math.max(g.bottom, w.top), _.left = Math.min(g.left, w.right), _.right = Math.max(g.right, w.left);
            for (var B in _.width = _.right - _.left, _.height = _.bottom - _.top, _) T[B] = _[B] - M[B];
            d.edges = l.prepared.edges, d.rect = _, d.deltaRect = T;
          }
        })(n), Rr(n);
      }, "interactions:action-end": function(n) {
        var t = n.iEvent, o = n.interaction;
        if (o.prepared.name === "resize" && o.prepared.edges) {
          var l = t;
          l.edges = o.prepared.edges, l.rect = o._rects.corrected, l.deltaRect = o._rects.delta;
        }
      }, "auto-start:check": function(n) {
        var t = n.interaction, o = n.interactable, l = n.element, d = n.rect, f = n.buttons;
        if (d) {
          var p = A({}, t.coords.cur.page), g = o.options.resize;
          if (g && g.enabled && (!t.pointerIsDown || !/mouse|pointer/.test(t.pointerType) || (f & g.mouseButtons) != 0)) {
            if (x.object(g.edges)) {
              var y = { left: !1, right: !1, top: !1, bottom: !1 };
              for (var w in y) y[w] = No(w, g.edges[w], p, t._latestPointer.eventTarget, l, d, g.margin || ft.defaultMargin);
              y.left = y.left && !y.right, y.top = y.top && !y.bottom, (y.left || y.right || y.top || y.bottom) && (n.action = { name: "resize", edges: y });
            } else {
              var _ = g.axis !== "y" && p.x > d.right - ft.defaultMargin, T = g.axis !== "x" && p.y > d.bottom - ft.defaultMargin;
              (_ || T) && (n.action = { name: "resize", axes: (_ ? "x" : "") + (T ? "y" : "") });
            }
            return !n.action && void 0;
          }
        }
      } }, defaults: { square: !1, preserveAspectRatio: !1, axis: "xy", margin: NaN, edges: null, invert: "none" }, cursors: null, getCursor: function(n) {
        var t = n.edges, o = n.axis, l = n.name, d = ft.cursors, f = null;
        if (o) f = d[l + o];
        else if (t) {
          for (var p = "", g = 0, y = ["top", "bottom", "left", "right"]; g < y.length; g++) {
            var w = y[g];
            t[w] && (p += w);
          }
          f = d[p];
        }
        return f;
      }, filterEventType: function(n) {
        return n.search("resize") === 0;
      }, defaultMargin: null }, Ho = ft, $o = { id: "actions", install: function(n) {
        n.usePlugin(Fo), n.usePlugin(Ho), n.usePlugin(Q), n.usePlugin(jo);
      } }, Tr = 0, mt = { request: function(n) {
        return dt(n);
      }, cancel: function(n) {
        return Rt(n);
      }, init: function(n) {
        if (dt = n.requestAnimationFrame, Rt = n.cancelAnimationFrame, !dt) for (var t = ["ms", "moz", "webkit", "o"], o = 0; o < t.length; o++) {
          var l = t[o];
          dt = n["".concat(l, "RequestAnimationFrame")], Rt = n["".concat(l, "CancelAnimationFrame")] || n["".concat(l, "CancelRequestAnimationFrame")];
        }
        dt = dt && dt.bind(n), Rt = Rt && Rt.bind(n), dt || (dt = function(d) {
          var f = Date.now(), p = Math.max(0, 16 - (f - Tr)), g = n.setTimeout((function() {
            d(f + p);
          }), p);
          return Tr = f + p, g;
        }, Rt = function(d) {
          return clearTimeout(d);
        });
      } }, ye = { defaults: { enabled: !1, margin: 60, container: null, speed: 300 }, now: Date.now, interaction: null, i: 0, x: 0, y: 0, isScrolling: !1, prevTime: 0, margin: 0, speed: 0, start: function(n) {
        ye.isScrolling = !0, mt.cancel(ye.i), n.autoScroll = ye, ye.interaction = n, ye.prevTime = ye.now(), ye.i = mt.request(ye.scroll);
      }, stop: function() {
        ye.isScrolling = !1, ye.interaction && (ye.interaction.autoScroll = null), mt.cancel(ye.i);
      }, scroll: function() {
        var n = ye.interaction, t = n.interactable, o = n.element, l = n.prepared.name, d = t.options[l].autoScroll, f = Ir(d.container, t, o), p = ye.now(), g = (p - ye.prevTime) / 1e3, y = d.speed * g;
        if (y >= 1) {
          var w = { x: ye.x * y, y: ye.y * y };
          if (w.x || w.y) {
            var _ = zr(f);
            x.window(f) ? f.scrollBy(w.x, w.y) : f && (f.scrollLeft += w.x, f.scrollTop += w.y);
            var T = zr(f), M = { x: T.x - _.x, y: T.y - _.y };
            (M.x || M.y) && t.fire({ type: "autoscroll", target: o, interactable: t, delta: M, interaction: n, container: f });
          }
          ye.prevTime = p;
        }
        ye.isScrolling && (mt.cancel(ye.i), ye.i = mt.request(ye.scroll));
      }, check: function(n, t) {
        var o;
        return (o = n.options[t].autoScroll) == null ? void 0 : o.enabled;
      }, onInteractionMove: function(n) {
        var t = n.interaction, o = n.pointer;
        if (t.interacting() && ye.check(t.interactable, t.prepared.name)) if (t.simulation) ye.x = ye.y = 0;
        else {
          var l, d, f, p, g = t.interactable, y = t.element, w = t.prepared.name, _ = g.options[w].autoScroll, T = Ir(_.container, g, y);
          if (x.window(T)) p = o.clientX < ye.margin, l = o.clientY < ye.margin, d = o.clientX > T.innerWidth - ye.margin, f = o.clientY > T.innerHeight - ye.margin;
          else {
            var M = Y(T);
            p = o.clientX < M.left + ye.margin, l = o.clientY < M.top + ye.margin, d = o.clientX > M.right - ye.margin, f = o.clientY > M.bottom - ye.margin;
          }
          ye.x = d ? 1 : p ? -1 : 0, ye.y = f ? 1 : l ? -1 : 0, ye.isScrolling || (ye.margin = _.margin, ye.speed = _.speed, ye.start(t));
        }
      } };
      function Ir(n, t, o) {
        return (x.string(n) ? se(n, t, o) : n) || W(o);
      }
      function zr(n) {
        return x.window(n) && (n = window.document.body), { x: n.scrollLeft, y: n.scrollTop };
      }
      var Uo = { id: "auto-scroll", install: function(n) {
        var t = n.defaults, o = n.actions;
        n.autoScroll = ye, ye.now = function() {
          return n.now();
        }, o.phaselessTypes.autoscroll = !0, t.perAction.autoScroll = ye.defaults;
      }, listeners: { "interactions:new": function(n) {
        n.interaction.autoScroll = null;
      }, "interactions:destroy": function(n) {
        n.interaction.autoScroll = null, ye.stop(), ye.interaction && (ye.interaction = null);
      }, "interactions:stop": ye.stop, "interactions:action-move": function(n) {
        return ye.onInteractionMove(n);
      } } }, Bo = Uo;
      function Ht(n, t) {
        var o = !1;
        return function() {
          return o || (q.console.warn(t), o = !0), n.apply(this, arguments);
        };
      }
      function En(n, t) {
        return n.name = t.name, n.axis = t.axis, n.edges = t.edges, n;
      }
      function qo(n) {
        return x.bool(n) ? (this.options.styleCursor = n, this) : n === null ? (delete this.options.styleCursor, this) : this.options.styleCursor;
      }
      function Vo(n) {
        return x.func(n) ? (this.options.actionChecker = n, this) : n === null ? (delete this.options.actionChecker, this) : this.options.actionChecker;
      }
      var Xo = { id: "auto-start/interactableMethods", install: function(n) {
        var t = n.Interactable;
        t.prototype.getAction = function(o, l, d, f) {
          var p = (function(g, y, w, _, T) {
            var M = g.getRect(_), $ = y.buttons || { 0: 1, 1: 4, 3: 8, 4: 16 }[y.button], N = { action: null, interactable: g, interaction: w, element: _, rect: M, buttons: $ };
            return T.fire("auto-start:check", N), N.action;
          })(this, l, d, f, n);
          return this.options.actionChecker ? this.options.actionChecker(o, l, p, this, f, d) : p;
        }, t.prototype.ignoreFrom = Ht((function(o) {
          return this._backCompatOption("ignoreFrom", o);
        }), "Interactable.ignoreFrom() has been deprecated. Use Interactble.draggable({ignoreFrom: newValue})."), t.prototype.allowFrom = Ht((function(o) {
          return this._backCompatOption("allowFrom", o);
        }), "Interactable.allowFrom() has been deprecated. Use Interactble.draggable({allowFrom: newValue})."), t.prototype.actionChecker = Vo, t.prototype.styleCursor = qo;
      } };
      function Er(n, t, o, l, d) {
        return t.testIgnoreAllow(t.options[n.name], o, l) && t.options[n.name].enabled && sn(t, o, n, d) ? n : null;
      }
      function Yo(n, t, o, l, d, f, p) {
        for (var g = 0, y = l.length; g < y; g++) {
          var w = l[g], _ = d[g], T = w.getAction(t, o, n, _);
          if (T) {
            var M = Er(T, w, _, f, p);
            if (M) return { action: M, interactable: w, element: _ };
          }
        }
        return { action: null, interactable: null, element: null };
      }
      function Or(n, t, o, l, d) {
        var f = [], p = [], g = l;
        function y(_) {
          f.push(_), p.push(g);
        }
        for (; x.element(g); ) {
          f = [], p = [], d.interactables.forEachMatch(g, y);
          var w = Yo(n, t, o, f, p, l, d);
          if (w.action && !w.interactable.options[w.action.name].manualStart) return w;
          g = Re(g);
        }
        return { action: null, interactable: null, element: null };
      }
      function Pr(n, t, o) {
        var l = t.action, d = t.interactable, f = t.element;
        l = l || { name: null }, n.interactable = d, n.element = f, En(n.prepared, l), n.rect = d && l.name ? d.getRect(f) : null, Ar(n, o), o.fire("autoStart:prepared", { interaction: n });
      }
      function sn(n, t, o, l) {
        var d = n.options, f = d[o.name].max, p = d[o.name].maxPerElement, g = l.autoStart.maxInteractions, y = 0, w = 0, _ = 0;
        if (!(f && p && g)) return !1;
        for (var T = 0, M = l.interactions.list; T < M.length; T++) {
          var $ = M[T], N = $.prepared.name;
          if ($.interacting() && (++y >= g || $.interactable === n && ((w += N === o.name ? 1 : 0) >= f || $.element === t && (_++, N === o.name && _ >= p))))
            return !1;
        }
        return g > 0;
      }
      function Mr(n, t) {
        return x.number(n) ? (t.autoStart.maxInteractions = n, this) : t.autoStart.maxInteractions;
      }
      function On(n, t, o) {
        var l = o.autoStart.cursorElement;
        l && l !== n && (l.style.cursor = ""), n.ownerDocument.documentElement.style.cursor = t, n.style.cursor = t, o.autoStart.cursorElement = t ? n : null;
      }
      function Ar(n, t) {
        var o = n.interactable, l = n.element, d = n.prepared;
        if (n.pointerType === "mouse" && o && o.options.styleCursor) {
          var f = "";
          if (d.name) {
            var p = o.options[d.name].cursorChecker;
            f = x.func(p) ? p(d, o, l, n._interacting) : t.actions.map[d.name].getCursor(d);
          }
          On(n.element, f || "", t);
        } else t.autoStart.cursorElement && On(t.autoStart.cursorElement, "", t);
      }
      var Ko = { id: "auto-start/base", before: ["actions"], install: function(n) {
        var t = n.interactStatic, o = n.defaults;
        n.usePlugin(Xo), o.base.actionChecker = null, o.base.styleCursor = !0, A(o.perAction, { manualStart: !1, max: 1 / 0, maxPerElement: 1, allowFrom: null, ignoreFrom: null, mouseButtons: 1 }), t.maxInteractions = function(l) {
          return Mr(l, n);
        }, n.autoStart = { maxInteractions: 1 / 0, withinInteractionLimit: sn, cursorElement: null };
      }, listeners: { "interactions:down": function(n, t) {
        var o = n.interaction, l = n.pointer, d = n.event, f = n.eventTarget;
        o.interacting() || Pr(o, Or(o, l, d, f, t), t);
      }, "interactions:move": function(n, t) {
        (function(o, l) {
          var d = o.interaction, f = o.pointer, p = o.event, g = o.eventTarget;
          d.pointerType !== "mouse" || d.pointerIsDown || d.interacting() || Pr(d, Or(d, f, p, g, l), l);
        })(n, t), (function(o, l) {
          var d = o.interaction;
          if (d.pointerIsDown && !d.interacting() && d.pointerWasMoved && d.prepared.name) {
            l.fire("autoStart:before-start", o);
            var f = d.interactable, p = d.prepared.name;
            p && f && (f.options[p].manualStart || !sn(f, d.element, d.prepared, l) ? d.stop() : (d.start(d.prepared, f, d.element), Ar(d, l)));
          }
        })(n, t);
      }, "interactions:stop": function(n, t) {
        var o = n.interaction, l = o.interactable;
        l && l.options.styleCursor && On(o.element, "", t);
      } }, maxInteractions: Mr, withinInteractionLimit: sn, validateAction: Er }, Pn = Ko, Zo = { id: "auto-start/dragAxis", listeners: { "autoStart:before-start": function(n, t) {
        var o = n.interaction, l = n.eventTarget, d = n.dx, f = n.dy;
        if (o.prepared.name === "drag") {
          var p = Math.abs(d), g = Math.abs(f), y = o.interactable.options.drag, w = y.startAxis, _ = p > g ? "x" : p < g ? "y" : "xy";
          if (o.prepared.axis = y.lockAxis === "start" ? _[0] : y.lockAxis, _ !== "xy" && w !== "xy" && w !== _) {
            o.prepared.name = null;
            for (var T = l, M = function(N) {
              if (N !== o.interactable) {
                var B = o.interactable.options.drag;
                if (!B.manualStart && N.testIgnoreAllow(B, T, l)) {
                  var ee = N.getAction(o.downPointer, o.downEvent, o, T);
                  if (ee && ee.name === "drag" && (function(K, ae) {
                    if (!ae) return !1;
                    var _e = ae.options.drag.startAxis;
                    return K === "xy" || _e === "xy" || _e === K;
                  })(_, N) && Pn.validateAction(ee, N, T, l, t)) return N;
                }
              }
            }; x.element(T); ) {
              var $ = t.interactables.forEachMatch(T, M);
              if ($) {
                o.prepared.name = "drag", o.interactable = $, o.element = T;
                break;
              }
              T = Re(T);
            }
          }
        }
      } } };
      function Mn(n) {
        var t = n.prepared && n.prepared.name;
        if (!t) return null;
        var o = n.interactable.options;
        return o[t].hold || o[t].delay;
      }
      var Qo = { id: "auto-start/hold", install: function(n) {
        var t = n.defaults;
        n.usePlugin(Pn), t.perAction.hold = 0, t.perAction.delay = 0;
      }, listeners: { "interactions:new": function(n) {
        n.interaction.autoStartHoldTimer = null;
      }, "autoStart:prepared": function(n) {
        var t = n.interaction, o = Mn(t);
        o > 0 && (t.autoStartHoldTimer = setTimeout((function() {
          t.start(t.prepared, t.interactable, t.element);
        }), o));
      }, "interactions:move": function(n) {
        var t = n.interaction, o = n.duplicate;
        t.autoStartHoldTimer && t.pointerWasMoved && !o && (clearTimeout(t.autoStartHoldTimer), t.autoStartHoldTimer = null);
      }, "autoStart:before-start": function(n) {
        var t = n.interaction;
        Mn(t) > 0 && (t.prepared.name = null);
      } }, getHoldDuration: Mn }, Jo = Qo, es = { id: "auto-start", install: function(n) {
        n.usePlugin(Pn), n.usePlugin(Jo), n.usePlugin(Zo);
      } }, ts = function(n) {
        return /^(always|never|auto)$/.test(n) ? (this.options.preventDefault = n, this) : x.bool(n) ? (this.options.preventDefault = n ? "always" : "never", this) : this.options.preventDefault;
      };
      function ns(n) {
        var t = n.interaction, o = n.event;
        t.interactable && t.interactable.checkAndPreventDefault(o);
      }
      var kr = { id: "core/interactablePreventDefault", install: function(n) {
        var t = n.Interactable;
        t.prototype.preventDefault = ts, t.prototype.checkAndPreventDefault = function(o) {
          return (function(l, d, f) {
            var p = l.options.preventDefault;
            if (p !== "never") if (p !== "always") {
              if (d.events.supportsPassive && /^touch(start|move)$/.test(f.type)) {
                var g = W(f.target).document, y = d.getDocOptions(g);
                if (!y || !y.events || y.events.passive !== !1) return;
              }
              /^(mouse|pointer|touch)*(down|start)/i.test(f.type) || x.element(f.target) && G(f.target, "input,select,textarea,[contenteditable=true],[contenteditable=true] *") || f.preventDefault();
            } else f.preventDefault();
          })(this, n, o);
        }, n.interactions.docEvents.push({ type: "dragstart", listener: function(o) {
          for (var l = 0, d = n.interactions.list; l < d.length; l++) {
            var f = d[l];
            if (f.element && (f.element === o.target || Te(f.element, o.target))) return void f.interactable.checkAndPreventDefault(o);
          }
        } });
      }, listeners: ["down", "move", "up", "cancel"].reduce((function(n, t) {
        return n["interactions:".concat(t)] = ns, n;
      }), {}) };
      function an(n, t) {
        if (t.phaselessTypes[n]) return !0;
        for (var o in t.map) if (n.indexOf(o) === 0 && n.substr(o.length) in t.phases) return !0;
        return !1;
      }
      function At(n) {
        var t = {};
        for (var o in n) {
          var l = n[o];
          x.plainObject(l) ? t[o] = At(l) : x.array(l) ? t[o] = _r(l) : t[o] = l;
        }
        return t;
      }
      var An = (function() {
        function n(t) {
          c(this, n), this.states = [], this.startOffset = { left: 0, right: 0, top: 0, bottom: 0 }, this.startDelta = void 0, this.result = void 0, this.endResult = void 0, this.startEdges = void 0, this.edges = void 0, this.interaction = void 0, this.interaction = t, this.result = ln(), this.edges = { left: !1, right: !1, top: !1, bottom: !1 };
        }
        return h(n, [{ key: "start", value: function(t, o) {
          var l, d, f = t.phase, p = this.interaction, g = (function(w) {
            var _ = w.interactable.options[w.prepared.name], T = _.modifiers;
            return T && T.length ? T : ["snap", "snapSize", "snapEdges", "restrict", "restrictEdges", "restrictSize"].map((function(M) {
              var $ = _[M];
              return $ && $.enabled && { options: $, methods: $._methods };
            })).filter((function(M) {
              return !!M;
            }));
          })(p);
          this.prepareStates(g), this.startEdges = A({}, p.edges), this.edges = A({}, this.startEdges), this.startOffset = (l = p.rect, d = o, l ? { left: d.x - l.left, top: d.y - l.top, right: l.right - d.x, bottom: l.bottom - d.y } : { left: 0, top: 0, right: 0, bottom: 0 }), this.startDelta = { x: 0, y: 0 };
          var y = this.fillArg({ phase: f, pageCoords: o, preEnd: !1 });
          return this.result = ln(), this.startAll(y), this.result = this.setAll(y);
        } }, { key: "fillArg", value: function(t) {
          var o = this.interaction;
          return t.interaction = o, t.interactable = o.interactable, t.element = o.element, t.rect || (t.rect = o.rect), t.edges || (t.edges = this.startEdges), t.startOffset = this.startOffset, t;
        } }, { key: "startAll", value: function(t) {
          for (var o = 0, l = this.states; o < l.length; o++) {
            var d = l[o];
            d.methods.start && (t.state = d, d.methods.start(t));
          }
        } }, { key: "setAll", value: function(t) {
          var o = t.phase, l = t.preEnd, d = t.skipModifiers, f = t.rect, p = t.edges;
          t.coords = A({}, t.pageCoords), t.rect = A({}, f), t.edges = A({}, p);
          for (var g = d ? this.states.slice(d) : this.states, y = ln(t.coords, t.rect), w = 0; w < g.length; w++) {
            var _, T = g[w], M = T.options, $ = A({}, t.coords), N = null;
            (_ = T.methods) != null && _.set && this.shouldDo(M, l, o) && (t.state = T, N = T.methods.set(t), re(t.edges, t.rect, { x: t.coords.x - $.x, y: t.coords.y - $.y })), y.eventProps.push(N);
          }
          A(this.edges, t.edges), y.delta.x = t.coords.x - t.pageCoords.x, y.delta.y = t.coords.y - t.pageCoords.y, y.rectDelta.left = t.rect.left - f.left, y.rectDelta.right = t.rect.right - f.right, y.rectDelta.top = t.rect.top - f.top, y.rectDelta.bottom = t.rect.bottom - f.bottom;
          var B = this.result.coords, ee = this.result.rect;
          if (B && ee) {
            var K = y.rect.left !== ee.left || y.rect.right !== ee.right || y.rect.top !== ee.top || y.rect.bottom !== ee.bottom;
            y.changed = K || B.x !== y.coords.x || B.y !== y.coords.y;
          }
          return y;
        } }, { key: "applyToInteraction", value: function(t) {
          var o = this.interaction, l = t.phase, d = o.coords.cur, f = o.coords.start, p = this.result, g = this.startDelta, y = p.delta;
          l === "start" && A(this.startDelta, p.delta);
          for (var w = 0, _ = [[f, g], [d, y]]; w < _.length; w++) {
            var T = _[w], M = T[0], $ = T[1];
            M.page.x += $.x, M.page.y += $.y, M.client.x += $.x, M.client.y += $.y;
          }
          var N = this.result.rectDelta, B = t.rect || o.rect;
          B.left += N.left, B.right += N.right, B.top += N.top, B.bottom += N.bottom, B.width = B.right - B.left, B.height = B.bottom - B.top;
        } }, { key: "setAndApply", value: function(t) {
          var o = this.interaction, l = t.phase, d = t.preEnd, f = t.skipModifiers, p = this.setAll(this.fillArg({ preEnd: d, phase: l, pageCoords: t.modifiedCoords || o.coords.cur.page }));
          if (this.result = p, !p.changed && (!f || f < this.states.length) && o.interacting()) return !1;
          if (t.modifiedCoords) {
            var g = o.coords.cur.page, y = { x: t.modifiedCoords.x - g.x, y: t.modifiedCoords.y - g.y };
            p.coords.x += y.x, p.coords.y += y.y, p.delta.x += y.x, p.delta.y += y.y;
          }
          this.applyToInteraction(t);
        } }, { key: "beforeEnd", value: function(t) {
          var o = t.interaction, l = t.event, d = this.states;
          if (d && d.length) {
            for (var f = !1, p = 0; p < d.length; p++) {
              var g = d[p];
              t.state = g;
              var y = g.options, w = g.methods, _ = w.beforeEnd && w.beforeEnd(t);
              if (_) return this.endResult = _, !1;
              f = f || !f && this.shouldDo(y, !0, t.phase, !0);
            }
            f && o.move({ event: l, preEnd: !0 });
          }
        } }, { key: "stop", value: function(t) {
          var o = t.interaction;
          if (this.states && this.states.length) {
            var l = A({ states: this.states, interactable: o.interactable, element: o.element, rect: null }, t);
            this.fillArg(l);
            for (var d = 0, f = this.states; d < f.length; d++) {
              var p = f[d];
              l.state = p, p.methods.stop && p.methods.stop(l);
            }
            this.states = null, this.endResult = null;
          }
        } }, { key: "prepareStates", value: function(t) {
          this.states = [];
          for (var o = 0; o < t.length; o++) {
            var l = t[o], d = l.options, f = l.methods, p = l.name;
            this.states.push({ options: d, methods: f, index: o, name: p });
          }
          return this.states;
        } }, { key: "restoreInteractionCoords", value: function(t) {
          var o = t.interaction, l = o.coords, d = o.rect, f = o.modification;
          if (f.result) {
            for (var p = f.startDelta, g = f.result, y = g.delta, w = g.rectDelta, _ = 0, T = [[l.start, p], [l.cur, y]]; _ < T.length; _++) {
              var M = T[_], $ = M[0], N = M[1];
              $.page.x -= N.x, $.page.y -= N.y, $.client.x -= N.x, $.client.y -= N.y;
            }
            d.left -= w.left, d.right -= w.right, d.top -= w.top, d.bottom -= w.bottom;
          }
        } }, { key: "shouldDo", value: function(t, o, l, d) {
          return !(!t || t.enabled === !1 || d && !t.endOnly || t.endOnly && !o || l === "start" && !t.setStart);
        } }, { key: "copyFrom", value: function(t) {
          this.startOffset = t.startOffset, this.startDelta = t.startDelta, this.startEdges = t.startEdges, this.edges = t.edges, this.states = t.states.map((function(o) {
            return At(o);
          })), this.result = ln(A({}, t.result.coords), A({}, t.result.rect));
        } }, { key: "destroy", value: function() {
          for (var t in this) this[t] = null;
        } }]), n;
      })();
      function ln(n, t) {
        return { rect: t, coords: n, delta: { x: 0, y: 0 }, rectDelta: { left: 0, right: 0, top: 0, bottom: 0 }, eventProps: [], changed: !0 };
      }
      function yt(n, t) {
        var o = n.defaults, l = { start: n.start, set: n.set, beforeEnd: n.beforeEnd, stop: n.stop }, d = function(f) {
          var p = f || {};
          for (var g in p.enabled = p.enabled !== !1, o) g in p || (p[g] = o[g]);
          var y = { options: p, methods: l, name: t, enable: function() {
            return p.enabled = !0, y;
          }, disable: function() {
            return p.enabled = !1, y;
          } };
          return y;
        };
        return t && typeof t == "string" && (d._defaults = o, d._methods = l), d;
      }
      function $t(n) {
        var t = n.iEvent, o = n.interaction.modification.result;
        o && (t.modifiers = o.eventProps);
      }
      var rs = { id: "modifiers/base", before: ["actions"], install: function(n) {
        n.defaults.perAction.modifiers = [];
      }, listeners: { "interactions:new": function(n) {
        var t = n.interaction;
        t.modification = new An(t);
      }, "interactions:before-action-start": function(n) {
        var t = n.interaction, o = n.interaction.modification;
        o.start(n, t.coords.start.page), t.edges = o.edges, o.applyToInteraction(n);
      }, "interactions:before-action-move": function(n) {
        var t = n.interaction, o = t.modification, l = o.setAndApply(n);
        return t.edges = o.edges, l;
      }, "interactions:before-action-end": function(n) {
        var t = n.interaction, o = t.modification, l = o.beforeEnd(n);
        return t.edges = o.startEdges, l;
      }, "interactions:action-start": $t, "interactions:action-move": $t, "interactions:action-end": $t, "interactions:after-action-start": function(n) {
        return n.interaction.modification.restoreInteractionCoords(n);
      }, "interactions:after-action-move": function(n) {
        return n.interaction.modification.restoreInteractionCoords(n);
      }, "interactions:stop": function(n) {
        return n.interaction.modification.stop(n);
      } } }, Dr = rs, Lr = { base: { preventDefault: "auto", deltaSource: "page" }, perAction: { enabled: !1, origin: { x: 0, y: 0 } }, actions: {} }, kn = (function(n) {
        m(o, n);
        var t = R(o);
        function o(l, d, f, p, g, y, w) {
          var _;
          c(this, o), (_ = t.call(this, l)).relatedTarget = null, _.screenX = void 0, _.screenY = void 0, _.button = void 0, _.buttons = void 0, _.ctrlKey = void 0, _.shiftKey = void 0, _.altKey = void 0, _.metaKey = void 0, _.page = void 0, _.client = void 0, _.delta = void 0, _.rect = void 0, _.x0 = void 0, _.y0 = void 0, _.t0 = void 0, _.dt = void 0, _.duration = void 0, _.clientX0 = void 0, _.clientY0 = void 0, _.velocity = void 0, _.speed = void 0, _.swipe = void 0, _.axes = void 0, _.preEnd = void 0, g = g || l.element;
          var T = l.interactable, M = (T && T.options || Lr).deltaSource, $ = ue(T, g, f), N = p === "start", B = p === "end", ee = N ? C(_) : l.prevEvent, K = N ? l.coords.start : B ? { page: ee.page, client: ee.client, timeStamp: l.coords.cur.timeStamp } : l.coords.cur;
          return _.page = A({}, K.page), _.client = A({}, K.client), _.rect = A({}, l.rect), _.timeStamp = K.timeStamp, B || (_.page.x -= $.x, _.page.y -= $.y, _.client.x -= $.x, _.client.y -= $.y), _.ctrlKey = d.ctrlKey, _.altKey = d.altKey, _.shiftKey = d.shiftKey, _.metaKey = d.metaKey, _.button = d.button, _.buttons = d.buttons, _.target = g, _.currentTarget = g, _.preEnd = y, _.type = w || f + (p || ""), _.interactable = T, _.t0 = N ? l.pointers[l.pointers.length - 1].downTime : ee.t0, _.x0 = l.coords.start.page.x - $.x, _.y0 = l.coords.start.page.y - $.y, _.clientX0 = l.coords.start.client.x - $.x, _.clientY0 = l.coords.start.client.y - $.y, _.delta = N || B ? { x: 0, y: 0 } : { x: _[M].x - ee[M].x, y: _[M].y - ee[M].y }, _.dt = l.coords.delta.timeStamp, _.duration = _.timeStamp - _.t0, _.velocity = A({}, l.coords.velocity[M]), _.speed = Ne(_.velocity.x, _.velocity.y), _.swipe = B || p === "inertiastart" ? _.getSwipe() : null, _;
        }
        return h(o, [{ key: "getSwipe", value: function() {
          var l = this._interaction;
          if (l.prevEvent.speed < 600 || this.timeStamp - l.prevEvent.timeStamp > 150) return null;
          var d = 180 * Math.atan2(l.prevEvent.velocityY, l.prevEvent.velocityX) / Math.PI;
          d < 0 && (d += 360);
          var f = 112.5 <= d && d < 247.5, p = 202.5 <= d && d < 337.5;
          return { up: p, down: !p && 22.5 <= d && d < 157.5, left: f, right: !f && (292.5 <= d || d < 67.5), angle: d, speed: l.prevEvent.speed, velocity: { x: l.prevEvent.velocityX, y: l.prevEvent.velocityY } };
        } }, { key: "preventDefault", value: function() {
        } }, { key: "stopImmediatePropagation", value: function() {
          this.immediatePropagationStopped = this.propagationStopped = !0;
        } }, { key: "stopPropagation", value: function() {
          this.propagationStopped = !0;
        } }]), o;
      })(on);
      Object.defineProperties(kn.prototype, { pageX: { get: function() {
        return this.page.x;
      }, set: function(n) {
        this.page.x = n;
      } }, pageY: { get: function() {
        return this.page.y;
      }, set: function(n) {
        this.page.y = n;
      } }, clientX: { get: function() {
        return this.client.x;
      }, set: function(n) {
        this.client.x = n;
      } }, clientY: { get: function() {
        return this.client.y;
      }, set: function(n) {
        this.client.y = n;
      } }, dx: { get: function() {
        return this.delta.x;
      }, set: function(n) {
        this.delta.x = n;
      } }, dy: { get: function() {
        return this.delta.y;
      }, set: function(n) {
        this.delta.y = n;
      } }, velocityX: { get: function() {
        return this.velocity.x;
      }, set: function(n) {
        this.velocity.x = n;
      } }, velocityY: { get: function() {
        return this.velocity.y;
      }, set: function(n) {
        this.velocity.y = n;
      } } });
      var is = h((function n(t, o, l, d, f) {
        c(this, n), this.id = void 0, this.pointer = void 0, this.event = void 0, this.downTime = void 0, this.downTarget = void 0, this.id = t, this.pointer = o, this.event = l, this.downTime = d, this.downTarget = f;
      })), os = (function(n) {
        return n.interactable = "", n.element = "", n.prepared = "", n.pointerIsDown = "", n.pointerWasMoved = "", n._proxy = "", n;
      })({}), Gr = (function(n) {
        return n.start = "", n.move = "", n.end = "", n.stop = "", n.interacting = "", n;
      })({}), ss = 0, as = (function() {
        function n(t) {
          var o = this, l = t.pointerType, d = t.scopeFire;
          c(this, n), this.interactable = null, this.element = null, this.rect = null, this._rects = void 0, this.edges = null, this._scopeFire = void 0, this.prepared = { name: null, axis: null, edges: null }, this.pointerType = void 0, this.pointers = [], this.downEvent = null, this.downPointer = {}, this._latestPointer = { pointer: null, event: null, eventTarget: null }, this.prevEvent = null, this.pointerIsDown = !1, this.pointerWasMoved = !1, this._interacting = !1, this._ending = !1, this._stopped = !0, this._proxy = void 0, this.simulation = null, this.doMove = Ht((function(_) {
            this.move(_);
          }), "The interaction.doMove() method has been renamed to interaction.move()"), this.coords = { start: { page: { x: 0, y: 0 }, client: { x: 0, y: 0 }, timeStamp: 0 }, prev: { page: { x: 0, y: 0 }, client: { x: 0, y: 0 }, timeStamp: 0 }, cur: { page: { x: 0, y: 0 }, client: { x: 0, y: 0 }, timeStamp: 0 }, delta: { page: { x: 0, y: 0 }, client: { x: 0, y: 0 }, timeStamp: 0 }, velocity: { page: { x: 0, y: 0 }, client: { x: 0, y: 0 }, timeStamp: 0 } }, this._id = ss++, this._scopeFire = d, this.pointerType = l;
          var f = this;
          this._proxy = {};
          var p = function(_) {
            Object.defineProperty(o._proxy, _, { get: function() {
              return f[_];
            } });
          };
          for (var g in os) p(g);
          var y = function(_) {
            Object.defineProperty(o._proxy, _, { value: function() {
              return f[_].apply(f, arguments);
            } });
          };
          for (var w in Gr) y(w);
          this._scopeFire("interactions:new", { interaction: this });
        }
        return h(n, [{ key: "pointerMoveTolerance", get: function() {
          return 1;
        } }, { key: "pointerDown", value: function(t, o, l) {
          var d = this.updatePointer(t, o, l, !0), f = this.pointers[d];
          this._scopeFire("interactions:down", { pointer: t, event: o, eventTarget: l, pointerIndex: d, pointerInfo: f, type: "down", interaction: this });
        } }, { key: "start", value: function(t, o, l) {
          return !(this.interacting() || !this.pointerIsDown || this.pointers.length < (t.name === "gesture" ? 2 : 1) || !o.options[t.name].enabled) && (En(this.prepared, t), this.interactable = o, this.element = l, this.rect = o.getRect(l), this.edges = this.prepared.edges ? A({}, this.prepared.edges) : { left: !0, right: !0, top: !0, bottom: !0 }, this._stopped = !1, this._interacting = this._doPhase({ interaction: this, event: this.downEvent, phase: "start" }) && !this._stopped, this._interacting);
        } }, { key: "pointerMove", value: function(t, o, l) {
          this.simulation || this.modification && this.modification.endResult || this.updatePointer(t, o, l, !1);
          var d, f, p = this.coords.cur.page.x === this.coords.prev.page.x && this.coords.cur.page.y === this.coords.prev.page.y && this.coords.cur.client.x === this.coords.prev.client.x && this.coords.cur.client.y === this.coords.prev.client.y;
          this.pointerIsDown && !this.pointerWasMoved && (d = this.coords.cur.client.x - this.coords.start.client.x, f = this.coords.cur.client.y - this.coords.start.client.y, this.pointerWasMoved = Ne(d, f) > this.pointerMoveTolerance);
          var g, y, w, _ = this.getPointerIndex(t), T = { pointer: t, pointerIndex: _, pointerInfo: this.pointers[_], event: o, type: "move", eventTarget: l, dx: d, dy: f, duplicate: p, interaction: this };
          p || (g = this.coords.velocity, y = this.coords.delta, w = Math.max(y.timeStamp / 1e3, 1e-3), g.page.x = y.page.x / w, g.page.y = y.page.y / w, g.client.x = y.client.x / w, g.client.y = y.client.y / w, g.timeStamp = w), this._scopeFire("interactions:move", T), p || this.simulation || (this.interacting() && (T.type = null, this.move(T)), this.pointerWasMoved && Ie(this.coords.prev, this.coords.cur));
        } }, { key: "move", value: function(t) {
          t && t.event || De(this.coords.delta), (t = A({ pointer: this._latestPointer.pointer, event: this._latestPointer.event, eventTarget: this._latestPointer.eventTarget, interaction: this }, t || {})).phase = "move", this._doPhase(t);
        } }, { key: "pointerUp", value: function(t, o, l, d) {
          var f = this.getPointerIndex(t);
          f === -1 && (f = this.updatePointer(t, o, l, !1));
          var p = /cancel$/i.test(o.type) ? "cancel" : "up";
          this._scopeFire("interactions:".concat(p), { pointer: t, pointerIndex: f, pointerInfo: this.pointers[f], event: o, eventTarget: l, type: p, curEventTarget: d, interaction: this }), this.simulation || this.end(o), this.removePointer(t, o);
        } }, { key: "documentBlur", value: function(t) {
          this.end(t), this._scopeFire("interactions:blur", { event: t, type: "blur", interaction: this });
        } }, { key: "end", value: function(t) {
          var o;
          this._ending = !0, t = t || this._latestPointer.event, this.interacting() && (o = this._doPhase({ event: t, interaction: this, phase: "end" })), this._ending = !1, o === !0 && this.stop();
        } }, { key: "currentAction", value: function() {
          return this._interacting ? this.prepared.name : null;
        } }, { key: "interacting", value: function() {
          return this._interacting;
        } }, { key: "stop", value: function() {
          this._scopeFire("interactions:stop", { interaction: this }), this.interactable = this.element = null, this._interacting = !1, this._stopped = !0, this.prepared.name = this.prevEvent = null;
        } }, { key: "getPointerIndex", value: function(t) {
          var o = Le(t);
          return this.pointerType === "mouse" || this.pointerType === "pen" ? this.pointers.length - 1 : Ft(this.pointers, (function(l) {
            return l.id === o;
          }));
        } }, { key: "getPointerInfo", value: function(t) {
          return this.pointers[this.getPointerIndex(t)];
        } }, { key: "updatePointer", value: function(t, o, l, d) {
          var f, p, g, y = Le(t), w = this.getPointerIndex(t), _ = this.pointers[w];
          return d = d !== !1 && (d || /(down|start)$/i.test(o.type)), _ ? _.pointer = t : (_ = new is(y, t, o, null, null), w = this.pointers.length, this.pointers.push(_)), Ue(this.coords.cur, this.pointers.map((function(T) {
            return T.pointer;
          })), this._now()), f = this.coords.delta, p = this.coords.prev, g = this.coords.cur, f.page.x = g.page.x - p.page.x, f.page.y = g.page.y - p.page.y, f.client.x = g.client.x - p.client.x, f.client.y = g.client.y - p.client.y, f.timeStamp = g.timeStamp - p.timeStamp, d && (this.pointerIsDown = !0, _.downTime = this.coords.cur.timeStamp, _.downTarget = l, we(this.downPointer, t), this.interacting() || (Ie(this.coords.start, this.coords.cur), Ie(this.coords.prev, this.coords.cur), this.downEvent = o, this.pointerWasMoved = !1)), this._updateLatestPointer(t, o, l), this._scopeFire("interactions:update-pointer", { pointer: t, event: o, eventTarget: l, down: d, pointerInfo: _, pointerIndex: w, interaction: this }), w;
        } }, { key: "removePointer", value: function(t, o) {
          var l = this.getPointerIndex(t);
          if (l !== -1) {
            var d = this.pointers[l];
            this._scopeFire("interactions:remove-pointer", { pointer: t, event: o, eventTarget: null, pointerIndex: l, pointerInfo: d, interaction: this }), this.pointers.splice(l, 1), this.pointerIsDown = !1;
          }
        } }, { key: "_updateLatestPointer", value: function(t, o, l) {
          this._latestPointer.pointer = t, this._latestPointer.event = o, this._latestPointer.eventTarget = l;
        } }, { key: "destroy", value: function() {
          this._latestPointer.pointer = null, this._latestPointer.event = null, this._latestPointer.eventTarget = null;
        } }, { key: "_createPreparedEvent", value: function(t, o, l, d) {
          return new kn(this, t, this.prepared.name, o, this.element, l, d);
        } }, { key: "_fireEvent", value: function(t) {
          var o;
          (o = this.interactable) == null || o.fire(t), (!this.prevEvent || t.timeStamp >= this.prevEvent.timeStamp) && (this.prevEvent = t);
        } }, { key: "_doPhase", value: function(t) {
          var o = t.event, l = t.phase, d = t.preEnd, f = t.type, p = this.rect;
          if (p && l === "move" && (re(this.edges, p, this.coords.delta[this.interactable.options.deltaSource]), p.width = p.right - p.left, p.height = p.bottom - p.top), this._scopeFire("interactions:before-action-".concat(l), t) === !1) return !1;
          var g = t.iEvent = this._createPreparedEvent(o, l, d, f);
          return this._scopeFire("interactions:action-".concat(l), t), l === "start" && (this.prevEvent = g), this._fireEvent(g), this._scopeFire("interactions:after-action-".concat(l), t), !0;
        } }, { key: "_now", value: function() {
          return Date.now();
        } }]), n;
      })();
      function Wr(n) {
        jr(n.interaction);
      }
      function jr(n) {
        if (!(function(o) {
          return !(!o.offset.pending.x && !o.offset.pending.y);
        })(n)) return !1;
        var t = n.offset.pending;
        return Dn(n.coords.cur, t), Dn(n.coords.delta, t), re(n.edges, n.rect, t), t.x = 0, t.y = 0, !0;
      }
      function ls(n) {
        var t = n.x, o = n.y;
        this.offset.pending.x += t, this.offset.pending.y += o, this.offset.total.x += t, this.offset.total.y += o;
      }
      function Dn(n, t) {
        var o = n.page, l = n.client, d = t.x, f = t.y;
        o.x += d, o.y += f, l.x += d, l.y += f;
      }
      Gr.offsetBy = "";
      var cs = { id: "offset", before: ["modifiers", "pointer-events", "actions", "inertia"], install: function(n) {
        n.Interaction.prototype.offsetBy = ls;
      }, listeners: { "interactions:new": function(n) {
        n.interaction.offset = { total: { x: 0, y: 0 }, pending: { x: 0, y: 0 } };
      }, "interactions:update-pointer": function(n) {
        return (function(t) {
          t.pointerIsDown && (Dn(t.coords.cur, t.offset.total), t.offset.pending.x = 0, t.offset.pending.y = 0);
        })(n.interaction);
      }, "interactions:before-action-start": Wr, "interactions:before-action-move": Wr, "interactions:before-action-end": function(n) {
        var t = n.interaction;
        if (jr(t)) return t.move({ offset: !0 }), t.end(), !1;
      }, "interactions:stop": function(n) {
        var t = n.interaction;
        t.offset.total.x = 0, t.offset.total.y = 0, t.offset.pending.x = 0, t.offset.pending.y = 0;
      } } }, Fr = cs, us = (function() {
        function n(t) {
          c(this, n), this.active = !1, this.isModified = !1, this.smoothEnd = !1, this.allowResume = !1, this.modification = void 0, this.modifierCount = 0, this.modifierArg = void 0, this.startCoords = void 0, this.t0 = 0, this.v0 = 0, this.te = 0, this.targetOffset = void 0, this.modifiedOffset = void 0, this.currentOffset = void 0, this.lambda_v0 = 0, this.one_ve_v0 = 0, this.timeout = void 0, this.interaction = void 0, this.interaction = t;
        }
        return h(n, [{ key: "start", value: function(t) {
          var o = this.interaction, l = cn(o);
          if (!l || !l.enabled) return !1;
          var d = o.coords.velocity.client, f = Ne(d.x, d.y), p = this.modification || (this.modification = new An(o));
          if (p.copyFrom(o.modification), this.t0 = o._now(), this.allowResume = l.allowResume, this.v0 = f, this.currentOffset = { x: 0, y: 0 }, this.startCoords = o.coords.cur.page, this.modifierArg = p.fillArg({ pageCoords: this.startCoords, preEnd: !0, phase: "inertiastart" }), this.t0 - o.coords.cur.timeStamp < 50 && f > l.minSpeed && f > l.endSpeed) this.startInertia();
          else {
            if (p.result = p.setAll(this.modifierArg), !p.result.changed) return !1;
            this.startSmoothEnd();
          }
          return o.modification.result.rect = null, o.offsetBy(this.targetOffset), o._doPhase({ interaction: o, event: t, phase: "inertiastart" }), o.offsetBy({ x: -this.targetOffset.x, y: -this.targetOffset.y }), o.modification.result.rect = null, this.active = !0, o.simulation = this, !0;
        } }, { key: "startInertia", value: function() {
          var t = this, o = this.interaction.coords.velocity.client, l = cn(this.interaction), d = l.resistance, f = -Math.log(l.endSpeed / this.v0) / d;
          this.targetOffset = { x: (o.x - f) / d, y: (o.y - f) / d }, this.te = f, this.lambda_v0 = d / this.v0, this.one_ve_v0 = 1 - l.endSpeed / this.v0;
          var p = this.modification, g = this.modifierArg;
          g.pageCoords = { x: this.startCoords.x + this.targetOffset.x, y: this.startCoords.y + this.targetOffset.y }, p.result = p.setAll(g), p.result.changed && (this.isModified = !0, this.modifiedOffset = { x: this.targetOffset.x + p.result.delta.x, y: this.targetOffset.y + p.result.delta.y }), this.onNextFrame((function() {
            return t.inertiaTick();
          }));
        } }, { key: "startSmoothEnd", value: function() {
          var t = this;
          this.smoothEnd = !0, this.isModified = !0, this.targetOffset = { x: this.modification.result.delta.x, y: this.modification.result.delta.y }, this.onNextFrame((function() {
            return t.smoothEndTick();
          }));
        } }, { key: "onNextFrame", value: function(t) {
          var o = this;
          this.timeout = mt.request((function() {
            o.active && t();
          }));
        } }, { key: "inertiaTick", value: function() {
          var t, o, l, d, f, p, g, y = this, w = this.interaction, _ = cn(w).resistance, T = (w._now() - this.t0) / 1e3;
          if (T < this.te) {
            var M, $ = 1 - (Math.exp(-_ * T) - this.lambda_v0) / this.one_ve_v0;
            this.isModified ? (t = 0, o = 0, l = this.targetOffset.x, d = this.targetOffset.y, f = this.modifiedOffset.x, p = this.modifiedOffset.y, M = { x: Nr(g = $, t, l, f), y: Nr(g, o, d, p) }) : M = { x: this.targetOffset.x * $, y: this.targetOffset.y * $ };
            var N = { x: M.x - this.currentOffset.x, y: M.y - this.currentOffset.y };
            this.currentOffset.x += N.x, this.currentOffset.y += N.y, w.offsetBy(N), w.move(), this.onNextFrame((function() {
              return y.inertiaTick();
            }));
          } else w.offsetBy({ x: this.modifiedOffset.x - this.currentOffset.x, y: this.modifiedOffset.y - this.currentOffset.y }), this.end();
        } }, { key: "smoothEndTick", value: function() {
          var t = this, o = this.interaction, l = o._now() - this.t0, d = cn(o).smoothEndDuration;
          if (l < d) {
            var f = { x: Hr(l, 0, this.targetOffset.x, d), y: Hr(l, 0, this.targetOffset.y, d) }, p = { x: f.x - this.currentOffset.x, y: f.y - this.currentOffset.y };
            this.currentOffset.x += p.x, this.currentOffset.y += p.y, o.offsetBy(p), o.move({ skipModifiers: this.modifierCount }), this.onNextFrame((function() {
              return t.smoothEndTick();
            }));
          } else o.offsetBy({ x: this.targetOffset.x - this.currentOffset.x, y: this.targetOffset.y - this.currentOffset.y }), this.end();
        } }, { key: "resume", value: function(t) {
          var o = t.pointer, l = t.event, d = t.eventTarget, f = this.interaction;
          f.offsetBy({ x: -this.currentOffset.x, y: -this.currentOffset.y }), f.updatePointer(o, l, d, !0), f._doPhase({ interaction: f, event: l, phase: "resume" }), Ie(f.coords.prev, f.coords.cur), this.stop();
        } }, { key: "end", value: function() {
          this.interaction.move(), this.interaction.end(), this.stop();
        } }, { key: "stop", value: function() {
          this.active = this.smoothEnd = !1, this.interaction.simulation = null, mt.cancel(this.timeout);
        } }]), n;
      })();
      function cn(n) {
        var t = n.interactable, o = n.prepared;
        return t && t.options && o.name && t.options[o.name].inertia;
      }
      var ds = { id: "inertia", before: ["modifiers", "actions"], install: function(n) {
        var t = n.defaults;
        n.usePlugin(Fr), n.usePlugin(Dr), n.actions.phases.inertiastart = !0, n.actions.phases.resume = !0, t.perAction.inertia = { enabled: !1, resistance: 10, minSpeed: 100, endSpeed: 10, allowResume: !0, smoothEndDuration: 300 };
      }, listeners: { "interactions:new": function(n) {
        var t = n.interaction;
        t.inertia = new us(t);
      }, "interactions:before-action-end": function(n) {
        var t = n.interaction, o = n.event;
        return (!t._interacting || t.simulation || !t.inertia.start(o)) && null;
      }, "interactions:down": function(n) {
        var t = n.interaction, o = n.eventTarget, l = t.inertia;
        if (l.active) for (var d = o; x.element(d); ) {
          if (d === t.element) {
            l.resume(n);
            break;
          }
          d = Re(d);
        }
      }, "interactions:stop": function(n) {
        var t = n.interaction.inertia;
        t.active && t.stop();
      }, "interactions:before-action-resume": function(n) {
        var t = n.interaction.modification;
        t.stop(n), t.start(n, n.interaction.coords.cur.page), t.applyToInteraction(n);
      }, "interactions:before-action-inertiastart": function(n) {
        return n.interaction.modification.setAndApply(n);
      }, "interactions:action-resume": $t, "interactions:action-inertiastart": $t, "interactions:after-action-inertiastart": function(n) {
        return n.interaction.modification.restoreInteractionCoords(n);
      }, "interactions:after-action-resume": function(n) {
        return n.interaction.modification.restoreInteractionCoords(n);
      } } };
      function Nr(n, t, o, l) {
        var d = 1 - n;
        return d * d * t + 2 * d * n * o + n * n * l;
      }
      function Hr(n, t, o, l) {
        return -o * (n /= l) * (n - 2) + t;
      }
      var fs = ds;
      function $r(n, t) {
        for (var o = 0; o < t.length; o++) {
          var l = t[o];
          if (n.immediatePropagationStopped) break;
          l(n);
        }
      }
      var Ur = (function() {
        function n(t) {
          c(this, n), this.options = void 0, this.types = {}, this.propagationStopped = !1, this.immediatePropagationStopped = !1, this.global = void 0, this.options = A({}, t || {});
        }
        return h(n, [{ key: "fire", value: function(t) {
          var o, l = this.global;
          (o = this.types[t.type]) && $r(t, o), !t.propagationStopped && l && (o = l[t.type]) && $r(t, o);
        } }, { key: "on", value: function(t, o) {
          var l = me(t, o);
          for (t in l) this.types[t] = Sr(this.types[t] || [], l[t]);
        } }, { key: "off", value: function(t, o) {
          var l = me(t, o);
          for (t in l) {
            var d = this.types[t];
            if (d && d.length) for (var f = 0, p = l[t]; f < p.length; f++) {
              var g = p[f], y = d.indexOf(g);
              y !== -1 && d.splice(y, 1);
            }
          }
        } }, { key: "getRect", value: function(t) {
          return null;
        } }]), n;
      })(), hs = (function() {
        function n(t) {
          c(this, n), this.currentTarget = void 0, this.originalEvent = void 0, this.type = void 0, this.originalEvent = t, we(this, t);
        }
        return h(n, [{ key: "preventOriginalDefault", value: function() {
          this.originalEvent.preventDefault();
        } }, { key: "stopPropagation", value: function() {
          this.originalEvent.stopPropagation();
        } }, { key: "stopImmediatePropagation", value: function() {
          this.originalEvent.stopImmediatePropagation();
        } }]), n;
      })();
      function Ut(n) {
        return x.object(n) ? { capture: !!n.capture, passive: !!n.passive } : { capture: !!n, passive: !1 };
      }
      function un(n, t) {
        return n === t || (typeof n == "boolean" ? !!t.capture === n && !t.passive : !!n.capture == !!t.capture && !!n.passive == !!t.passive);
      }
      var ps = { id: "events", install: function(n) {
        var t, o = [], l = {}, d = [], f = { add: p, remove: g, addDelegate: function(_, T, M, $, N) {
          var B = Ut(N);
          if (!l[M]) {
            l[M] = [];
            for (var ee = 0; ee < d.length; ee++) {
              var K = d[ee];
              p(K, M, y), p(K, M, w, !0);
            }
          }
          var ae = l[M], _e = Nt(ae, (function(xe) {
            return xe.selector === _ && xe.context === T;
          }));
          _e || (_e = { selector: _, context: T, listeners: [] }, ae.push(_e)), _e.listeners.push({ func: $, options: B });
        }, removeDelegate: function(_, T, M, $, N) {
          var B, ee = Ut(N), K = l[M], ae = !1;
          if (K)
            for (B = K.length - 1; B >= 0; B--) {
              var _e = K[B];
              if (_e.selector === _ && _e.context === T) {
                for (var xe = _e.listeners, ge = xe.length - 1; ge >= 0; ge--) {
                  var be = xe[ge];
                  if (be.func === $ && un(be.options, ee)) {
                    xe.splice(ge, 1), xe.length || (K.splice(B, 1), g(T, M, y), g(T, M, w, !0)), ae = !0;
                    break;
                  }
                }
                if (ae) break;
              }
            }
        }, delegateListener: y, delegateUseCapture: w, delegatedEvents: l, documents: d, targets: o, supportsOptions: !1, supportsPassive: !1 };
        function p(_, T, M, $) {
          if (_.addEventListener) {
            var N = Ut($), B = Nt(o, (function(ee) {
              return ee.eventTarget === _;
            }));
            B || (B = { eventTarget: _, events: {} }, o.push(B)), B.events[T] || (B.events[T] = []), Nt(B.events[T], (function(ee) {
              return ee.func === M && un(ee.options, N);
            })) || (_.addEventListener(T, M, f.supportsOptions ? N : N.capture), B.events[T].push({ func: M, options: N }));
          }
        }
        function g(_, T, M, $) {
          if (_.addEventListener && _.removeEventListener) {
            var N = Ft(o, (function(qe) {
              return qe.eventTarget === _;
            })), B = o[N];
            if (B && B.events) if (T !== "all") {
              var ee = !1, K = B.events[T];
              if (K) {
                if (M === "all") {
                  for (var ae = K.length - 1; ae >= 0; ae--) {
                    var _e = K[ae];
                    g(_, T, _e.func, _e.options);
                  }
                  return;
                }
                for (var xe = Ut($), ge = 0; ge < K.length; ge++) {
                  var be = K[ge];
                  if (be.func === M && un(be.options, xe)) {
                    _.removeEventListener(T, M, f.supportsOptions ? xe : xe.capture), K.splice(ge, 1), K.length === 0 && (delete B.events[T], ee = !0);
                    break;
                  }
                }
              }
              ee && !Object.keys(B.events).length && o.splice(N, 1);
            } else for (T in B.events) B.events.hasOwnProperty(T) && g(_, T, "all");
          }
        }
        function y(_, T) {
          for (var M = Ut(T), $ = new hs(_), N = l[_.type], B = yr(_)[0], ee = B; x.element(ee); ) {
            for (var K = 0; K < N.length; K++) {
              var ae = N[K], _e = ae.selector, xe = ae.context;
              if (G(ee, _e) && Te(xe, B) && Te(xe, ee)) {
                var ge = ae.listeners;
                $.currentTarget = ee;
                for (var be = 0; be < ge.length; be++) {
                  var qe = ge[be];
                  un(qe.options, M) && qe.func($);
                }
              }
            }
            ee = Re(ee);
          }
        }
        function w(_) {
          return y(_, !0);
        }
        return (t = n.document) == null || t.createElement("div").addEventListener("test", null, { get capture() {
          return f.supportsOptions = !0;
        }, get passive() {
          return f.supportsPassive = !0;
        } }), n.events = f, f;
      } }, Ln = { methodOrder: ["simulationResume", "mouseOrPen", "hasPointer", "idle"], search: function(n) {
        for (var t = 0, o = Ln.methodOrder; t < o.length; t++) {
          var l = o[t], d = Ln[l](n);
          if (d) return d;
        }
        return null;
      }, simulationResume: function(n) {
        var t = n.pointerType, o = n.eventType, l = n.eventTarget, d = n.scope;
        if (!/down|start/i.test(o)) return null;
        for (var f = 0, p = d.interactions.list; f < p.length; f++) {
          var g = p[f], y = l;
          if (g.simulation && g.simulation.allowResume && g.pointerType === t) for (; y; ) {
            if (y === g.element) return g;
            y = Re(y);
          }
        }
        return null;
      }, mouseOrPen: function(n) {
        var t, o = n.pointerId, l = n.pointerType, d = n.eventType, f = n.scope;
        if (l !== "mouse" && l !== "pen") return null;
        for (var p = 0, g = f.interactions.list; p < g.length; p++) {
          var y = g[p];
          if (y.pointerType === l) {
            if (y.simulation && !Br(y, o)) continue;
            if (y.interacting()) return y;
            t || (t = y);
          }
        }
        if (t) return t;
        for (var w = 0, _ = f.interactions.list; w < _.length; w++) {
          var T = _[w];
          if (!(T.pointerType !== l || /down/i.test(d) && T.simulation)) return T;
        }
        return null;
      }, hasPointer: function(n) {
        for (var t = n.pointerId, o = 0, l = n.scope.interactions.list; o < l.length; o++) {
          var d = l[o];
          if (Br(d, t)) return d;
        }
        return null;
      }, idle: function(n) {
        for (var t = n.pointerType, o = 0, l = n.scope.interactions.list; o < l.length; o++) {
          var d = l[o];
          if (d.pointers.length === 1) {
            var f = d.interactable;
            if (f && (!f.options.gesture || !f.options.gesture.enabled)) continue;
          } else if (d.pointers.length >= 2) continue;
          if (!d.interacting() && t === d.pointerType) return d;
        }
        return null;
      } };
      function Br(n, t) {
        return n.pointers.some((function(o) {
          return o.id === t;
        }));
      }
      var vs = Ln, Gn = ["pointerDown", "pointerMove", "pointerUp", "updatePointer", "removePointer", "windowBlur"];
      function qr(n, t) {
        return function(o) {
          var l = t.interactions.list, d = mr(o), f = yr(o), p = f[0], g = f[1], y = [];
          if (/^touch/.test(o.type)) {
            t.prevTouchTime = t.now();
            for (var w = 0, _ = o.changedTouches; w < _.length; w++) {
              var T = _[w], M = { pointer: T, pointerId: Le(T), pointerType: d, eventType: o.type, eventTarget: p, curEventTarget: g, scope: t }, $ = Vr(M);
              y.push([M.pointer, M.eventTarget, M.curEventTarget, $]);
            }
          } else {
            var N = !1;
            if (!Se.supportsPointerEvent && /mouse/.test(o.type)) {
              for (var B = 0; B < l.length && !N; B++) N = l[B].pointerType !== "mouse" && l[B].pointerIsDown;
              N = N || t.now() - t.prevTouchTime < 500 || o.timeStamp === 0;
            }
            if (!N) {
              var ee = { pointer: o, pointerId: Le(o), pointerType: d, eventType: o.type, curEventTarget: g, eventTarget: p, scope: t }, K = Vr(ee);
              y.push([ee.pointer, ee.eventTarget, ee.curEventTarget, K]);
            }
          }
          for (var ae = 0; ae < y.length; ae++) {
            var _e = y[ae], xe = _e[0], ge = _e[1], be = _e[2];
            _e[3][n](xe, o, ge, be);
          }
        };
      }
      function Vr(n) {
        var t = n.pointerType, o = n.scope, l = { interaction: vs.search(n), searchDetails: n };
        return o.fire("interactions:find", l), l.interaction || o.interactions.new({ pointerType: t });
      }
      function Wn(n, t) {
        var o = n.doc, l = n.scope, d = n.options, f = l.interactions.docEvents, p = l.events, g = p[t];
        for (var y in l.browser.isIOS && !d.events && (d.events = { passive: !1 }), p.delegatedEvents) g(o, y, p.delegateListener), g(o, y, p.delegateUseCapture, !0);
        for (var w = d && d.events, _ = 0; _ < f.length; _++) {
          var T = f[_];
          g(o, T.type, T.listener, w);
        }
      }
      var gs = { id: "core/interactions", install: function(n) {
        for (var t = {}, o = 0; o < Gn.length; o++) {
          var l = Gn[o];
          t[l] = qr(l, n);
        }
        var d, f = Se.pEventTypes;
        function p() {
          for (var g = 0, y = n.interactions.list; g < y.length; g++) {
            var w = y[g];
            if (w.pointerIsDown && w.pointerType === "touch" && !w._interacting) for (var _ = function() {
              var $ = M[T];
              n.documents.some((function(N) {
                return Te(N.doc, $.downTarget);
              })) || w.removePointer($.pointer, $.event);
            }, T = 0, M = w.pointers; T < M.length; T++) _();
          }
        }
        (d = he.PointerEvent ? [{ type: f.down, listener: p }, { type: f.down, listener: t.pointerDown }, { type: f.move, listener: t.pointerMove }, { type: f.up, listener: t.pointerUp }, { type: f.cancel, listener: t.pointerUp }] : [{ type: "mousedown", listener: t.pointerDown }, { type: "mousemove", listener: t.pointerMove }, { type: "mouseup", listener: t.pointerUp }, { type: "touchstart", listener: p }, { type: "touchstart", listener: t.pointerDown }, { type: "touchmove", listener: t.pointerMove }, { type: "touchend", listener: t.pointerUp }, { type: "touchcancel", listener: t.pointerUp }]).push({ type: "blur", listener: function(g) {
          for (var y = 0, w = n.interactions.list; y < w.length; y++)
            w[y].documentBlur(g);
        } }), n.prevTouchTime = 0, n.Interaction = (function(g) {
          m(w, g);
          var y = R(w);
          function w() {
            return c(this, w), y.apply(this, arguments);
          }
          return h(w, [{ key: "pointerMoveTolerance", get: function() {
            return n.interactions.pointerMoveTolerance;
          }, set: function(_) {
            n.interactions.pointerMoveTolerance = _;
          } }, { key: "_now", value: function() {
            return n.now();
          } }]), w;
        })(as), n.interactions = { list: [], new: function(g) {
          g.scopeFire = function(w, _) {
            return n.fire(w, _);
          };
          var y = new n.Interaction(g);
          return n.interactions.list.push(y), y;
        }, listeners: t, docEvents: d, pointerMoveTolerance: 1 }, n.usePlugin(kr);
      }, listeners: { "scope:add-document": function(n) {
        return Wn(n, "add");
      }, "scope:remove-document": function(n) {
        return Wn(n, "remove");
      }, "interactable:unset": function(n, t) {
        for (var o = n.interactable, l = t.interactions.list.length - 1; l >= 0; l--) {
          var d = t.interactions.list[l];
          d.interactable === o && (d.stop(), t.fire("interactions:destroy", { interaction: d }), d.destroy(), t.interactions.list.length > 2 && t.interactions.list.splice(l, 1));
        }
      } }, onDocSignal: Wn, doOnInteractions: qr, methodNames: Gn }, ms = gs, St = (function(n) {
        return n[n.On = 0] = "On", n[n.Off = 1] = "Off", n;
      })(St || {}), ys = (function() {
        function n(t, o, l, d) {
          c(this, n), this.target = void 0, this.options = void 0, this._actions = void 0, this.events = new Ur(), this._context = void 0, this._win = void 0, this._doc = void 0, this._scopeEvents = void 0, this._actions = o.actions, this.target = t, this._context = o.context || l, this._win = W(fe(t) ? this._context : t), this._doc = this._win.document, this._scopeEvents = d, this.set(o);
        }
        return h(n, [{ key: "_defaults", get: function() {
          return { base: {}, perAction: {}, actions: {} };
        } }, { key: "setOnEvents", value: function(t, o) {
          return x.func(o.onstart) && this.on("".concat(t, "start"), o.onstart), x.func(o.onmove) && this.on("".concat(t, "move"), o.onmove), x.func(o.onend) && this.on("".concat(t, "end"), o.onend), x.func(o.oninertiastart) && this.on("".concat(t, "inertiastart"), o.oninertiastart), this;
        } }, { key: "updatePerActionListeners", value: function(t, o, l) {
          var d, f = this, p = (d = this._actions.map[t]) == null ? void 0 : d.filterEventType, g = function(y) {
            return (p == null || p(y)) && an(y, f._actions);
          };
          (x.array(o) || x.object(o)) && this._onOff(St.Off, t, o, void 0, g), (x.array(l) || x.object(l)) && this._onOff(St.On, t, l, void 0, g);
        } }, { key: "setPerAction", value: function(t, o) {
          var l = this._defaults;
          for (var d in o) {
            var f = d, p = this.options[t], g = o[f];
            f === "listeners" && this.updatePerActionListeners(t, p.listeners, g), x.array(g) ? p[f] = _r(g) : x.plainObject(g) ? (p[f] = A(p[f] || {}, At(g)), x.object(l.perAction[f]) && "enabled" in l.perAction[f] && (p[f].enabled = g.enabled !== !1)) : x.bool(g) && x.object(l.perAction[f]) ? p[f].enabled = g : p[f] = g;
          }
        } }, { key: "getRect", value: function(t) {
          return t = t || (x.element(this.target) ? this.target : null), x.string(this.target) && (t = t || this._context.querySelector(this.target)), Z(t);
        } }, { key: "rectChecker", value: function(t) {
          var o = this;
          return x.func(t) ? (this.getRect = function(l) {
            var d = A({}, t.apply(o, l));
            return "width" in d || (d.width = d.right - d.left, d.height = d.bottom - d.top), d;
          }, this) : t === null ? (delete this.getRect, this) : this.getRect;
        } }, { key: "_backCompatOption", value: function(t, o) {
          if (fe(o) || x.object(o)) {
            for (var l in this.options[t] = o, this._actions.map) this.options[l][t] = o;
            return this;
          }
          return this.options[t];
        } }, { key: "origin", value: function(t) {
          return this._backCompatOption("origin", t);
        } }, { key: "deltaSource", value: function(t) {
          return t === "page" || t === "client" ? (this.options.deltaSource = t, this) : this.options.deltaSource;
        } }, { key: "getAllElements", value: function() {
          var t = this.target;
          return x.string(t) ? Array.from(this._context.querySelectorAll(t)) : x.func(t) && t.getAllElements ? t.getAllElements() : x.element(t) ? [t] : [];
        } }, { key: "context", value: function() {
          return this._context;
        } }, { key: "inContext", value: function(t) {
          return this._context === t.ownerDocument || Te(this._context, t);
        } }, { key: "testIgnoreAllow", value: function(t, o, l) {
          return !this.testIgnore(t.ignoreFrom, o, l) && this.testAllow(t.allowFrom, o, l);
        } }, { key: "testAllow", value: function(t, o, l) {
          return !t || !!x.element(l) && (x.string(t) ? U(l, t, o) : !!x.element(t) && Te(t, l));
        } }, { key: "testIgnore", value: function(t, o, l) {
          return !(!t || !x.element(l)) && (x.string(t) ? U(l, t, o) : !!x.element(t) && Te(t, l));
        } }, { key: "fire", value: function(t) {
          return this.events.fire(t), this;
        } }, { key: "_onOff", value: function(t, o, l, d, f) {
          x.object(o) && !x.array(o) && (d = l, l = null);
          var p = me(o, l, f);
          for (var g in p) {
            g === "wheel" && (g = Se.wheelEvent);
            for (var y = 0, w = p[g]; y < w.length; y++) {
              var _ = w[y];
              an(g, this._actions) ? this.events[t === St.On ? "on" : "off"](g, _) : x.string(this.target) ? this._scopeEvents[t === St.On ? "addDelegate" : "removeDelegate"](this.target, this._context, g, _, d) : this._scopeEvents[t === St.On ? "add" : "remove"](this.target, g, _, d);
            }
          }
          return this;
        } }, { key: "on", value: function(t, o, l) {
          return this._onOff(St.On, t, o, l);
        } }, { key: "off", value: function(t, o, l) {
          return this._onOff(St.Off, t, o, l);
        } }, { key: "set", value: function(t) {
          var o = this._defaults;
          for (var l in x.object(t) || (t = {}), this.options = At(o.base), this._actions.methodDict) {
            var d = l, f = this._actions.methodDict[d];
            this.options[d] = {}, this.setPerAction(d, A(A({}, o.perAction), o.actions[d])), this[f](t[d]);
          }
          for (var p in t) p !== "getRect" ? x.func(this[p]) && this[p](t[p]) : this.rectChecker(t.getRect);
          return this;
        } }, { key: "unset", value: function() {
          if (x.string(this.target)) for (var t in this._scopeEvents.delegatedEvents) for (var o = this._scopeEvents.delegatedEvents[t], l = o.length - 1; l >= 0; l--) {
            var d = o[l], f = d.selector, p = d.context, g = d.listeners;
            f === this.target && p === this._context && o.splice(l, 1);
            for (var y = g.length - 1; y >= 0; y--) this._scopeEvents.removeDelegate(this.target, this._context, t, g[y][0], g[y][1]);
          }
          else this._scopeEvents.remove(this.target, "all");
        } }]), n;
      })(), Ss = (function() {
        function n(t) {
          var o = this;
          c(this, n), this.list = [], this.selectorMap = {}, this.scope = void 0, this.scope = t, t.addListeners({ "interactable:unset": function(l) {
            var d = l.interactable, f = d.target, p = x.string(f) ? o.selectorMap[f] : f[o.scope.id], g = Ft(p, (function(y) {
              return y === d;
            }));
            p.splice(g, 1);
          } });
        }
        return h(n, [{ key: "new", value: function(t, o) {
          o = A(o || {}, { actions: this.scope.actions });
          var l = new this.scope.Interactable(t, o, this.scope.document, this.scope.events);
          return this.scope.addDocument(l._doc), this.list.push(l), x.string(t) ? (this.selectorMap[t] || (this.selectorMap[t] = []), this.selectorMap[t].push(l)) : (l.target[this.scope.id] || Object.defineProperty(t, this.scope.id, { value: [], configurable: !0 }), t[this.scope.id].push(l)), this.scope.fire("interactable:new", { target: t, options: o, interactable: l, win: this.scope._win }), l;
        } }, { key: "getExisting", value: function(t, o) {
          var l = o && o.context || this.scope.document, d = x.string(t), f = d ? this.selectorMap[t] : t[this.scope.id];
          if (f) return Nt(f, (function(p) {
            return p._context === l && (d || p.inContext(t));
          }));
        } }, { key: "forEachMatch", value: function(t, o) {
          for (var l = 0, d = this.list; l < d.length; l++) {
            var f = d[l], p = void 0;
            if ((x.string(f.target) ? x.element(t) && G(t, f.target) : t === f.target) && f.inContext(t) && (p = o(f)), p !== void 0) return p;
          }
        } }]), n;
      })(), _s = (function() {
        function n() {
          var t = this;
          c(this, n), this.id = "__interact_scope_".concat(Math.floor(100 * Math.random())), this.isInitialized = !1, this.listenerMaps = [], this.browser = Se, this.defaults = At(Lr), this.Eventable = Ur, this.actions = { map: {}, phases: { start: !0, move: !0, end: !0 }, methodDict: {}, phaselessTypes: {} }, this.interactStatic = (function(l) {
            var d = function f(p, g) {
              var y = l.interactables.getExisting(p, g);
              return y || ((y = l.interactables.new(p, g)).events.global = f.globalEvents), y;
            };
            return d.getPointerAverage = ut, d.getTouchBBox = ot, d.getTouchDistance = st, d.getTouchAngle = xt, d.getElementRect = Z, d.getElementClientRect = Y, d.matchesSelector = G, d.closest = Fe, d.globalEvents = {}, d.version = "1.10.27", d.scope = l, d.use = function(f, p) {
              return this.scope.usePlugin(f, p), this;
            }, d.isSet = function(f, p) {
              return !!this.scope.interactables.get(f, p && p.context);
            }, d.on = Ht((function(f, p, g) {
              if (x.string(f) && f.search(" ") !== -1 && (f = f.trim().split(/ +/)), x.array(f)) {
                for (var y = 0, w = f; y < w.length; y++) {
                  var _ = w[y];
                  this.on(_, p, g);
                }
                return this;
              }
              if (x.object(f)) {
                for (var T in f) this.on(T, f[T], p);
                return this;
              }
              return an(f, this.scope.actions) ? this.globalEvents[f] ? this.globalEvents[f].push(p) : this.globalEvents[f] = [p] : this.scope.events.add(this.scope.document, f, p, { options: g }), this;
            }), "The interact.on() method is being deprecated"), d.off = Ht((function(f, p, g) {
              if (x.string(f) && f.search(" ") !== -1 && (f = f.trim().split(/ +/)), x.array(f)) {
                for (var y = 0, w = f; y < w.length; y++) {
                  var _ = w[y];
                  this.off(_, p, g);
                }
                return this;
              }
              if (x.object(f)) {
                for (var T in f) this.off(T, f[T], p);
                return this;
              }
              var M;
              return an(f, this.scope.actions) ? f in this.globalEvents && (M = this.globalEvents[f].indexOf(p)) !== -1 && this.globalEvents[f].splice(M, 1) : this.scope.events.remove(this.scope.document, f, p, g), this;
            }), "The interact.off() method is being deprecated"), d.debug = function() {
              return this.scope;
            }, d.supportsTouch = function() {
              return Se.supportsTouch;
            }, d.supportsPointerEvent = function() {
              return Se.supportsPointerEvent;
            }, d.stop = function() {
              for (var f = 0, p = this.scope.interactions.list; f < p.length; f++) p[f].stop();
              return this;
            }, d.pointerMoveTolerance = function(f) {
              return x.number(f) ? (this.scope.interactions.pointerMoveTolerance = f, this) : this.scope.interactions.pointerMoveTolerance;
            }, d.addDocument = function(f, p) {
              this.scope.addDocument(f, p);
            }, d.removeDocument = function(f) {
              this.scope.removeDocument(f);
            }, d;
          })(this), this.InteractEvent = kn, this.Interactable = void 0, this.interactables = new Ss(this), this._win = void 0, this.document = void 0, this.window = void 0, this.documents = [], this._plugins = { list: [], map: {} }, this.onWindowUnload = function(l) {
            return t.removeDocument(l.target);
          };
          var o = this;
          this.Interactable = (function(l) {
            m(f, l);
            var d = R(f);
            function f() {
              return c(this, f), d.apply(this, arguments);
            }
            return h(f, [{ key: "_defaults", get: function() {
              return o.defaults;
            } }, { key: "set", value: function(p) {
              return z(S(f.prototype), "set", this).call(this, p), o.fire("interactable:set", { options: p, interactable: this }), this;
            } }, { key: "unset", value: function() {
              z(S(f.prototype), "unset", this).call(this);
              var p = o.interactables.list.indexOf(this);
              p < 0 || (o.interactables.list.splice(p, 1), o.fire("interactable:unset", { interactable: this }));
            } }]), f;
          })(ys);
        }
        return h(n, [{ key: "addListeners", value: function(t, o) {
          this.listenerMaps.push({ id: o, map: t });
        } }, { key: "fire", value: function(t, o) {
          for (var l = 0, d = this.listenerMaps; l < d.length; l++) {
            var f = d[l].map[t];
            if (f && f(o, this, t) === !1) return !1;
          }
        } }, { key: "init", value: function(t) {
          return this.isInitialized ? this : (function(o, l) {
            return o.isInitialized = !0, x.window(l) && P(l), he.init(l), Se.init(l), mt.init(l), o.window = l, o.document = l.document, o.usePlugin(ms), o.usePlugin(ps), o;
          })(this, t);
        } }, { key: "pluginIsInstalled", value: function(t) {
          var o = t.id;
          return o ? !!this._plugins.map[o] : this._plugins.list.indexOf(t) !== -1;
        } }, { key: "usePlugin", value: function(t, o) {
          if (!this.isInitialized) return this;
          if (this.pluginIsInstalled(t)) return this;
          if (t.id && (this._plugins.map[t.id] = t), this._plugins.list.push(t), t.install && t.install(this, o), t.listeners && t.before) {
            for (var l = 0, d = this.listenerMaps.length, f = t.before.reduce((function(g, y) {
              return g[y] = !0, g[Xr(y)] = !0, g;
            }), {}); l < d; l++) {
              var p = this.listenerMaps[l].id;
              if (p && (f[p] || f[Xr(p)])) break;
            }
            this.listenerMaps.splice(l, 0, { id: t.id, map: t.listeners });
          } else t.listeners && this.listenerMaps.push({ id: t.id, map: t.listeners });
          return this;
        } }, { key: "addDocument", value: function(t, o) {
          if (this.getDocIndex(t) !== -1) return !1;
          var l = W(t);
          o = o ? A({}, o) : {}, this.documents.push({ doc: t, options: o }), this.events.documents.push(t), t !== this.document && this.events.add(l, "unload", this.onWindowUnload), this.fire("scope:add-document", { doc: t, window: l, scope: this, options: o });
        } }, { key: "removeDocument", value: function(t) {
          var o = this.getDocIndex(t), l = W(t), d = this.documents[o].options;
          this.events.remove(l, "unload", this.onWindowUnload), this.documents.splice(o, 1), this.events.documents.splice(o, 1), this.fire("scope:remove-document", { doc: t, window: l, scope: this, options: d });
        } }, { key: "getDocIndex", value: function(t) {
          for (var o = 0; o < this.documents.length; o++) if (this.documents[o].doc === t) return o;
          return -1;
        } }, { key: "getDocOptions", value: function(t) {
          var o = this.getDocIndex(t);
          return o === -1 ? null : this.documents[o].options;
        } }, { key: "now", value: function() {
          return (this.window.Date || Date).now();
        } }]), n;
      })();
      function Xr(n) {
        return n && n.replace(/\/.*$/, "");
      }
      var Yr = new _s(), Be = Yr.interactStatic, bs = typeof globalThis < "u" ? globalThis : window;
      Yr.init(bs);
      var ws = Object.freeze({ __proto__: null, edgeTarget: function() {
      }, elements: function() {
      }, grid: function(n) {
        var t = [["x", "y"], ["left", "top"], ["right", "bottom"], ["width", "height"]].filter((function(l) {
          var d = l[0], f = l[1];
          return d in n || f in n;
        })), o = function(l, d) {
          for (var f = n.range, p = n.limits, g = p === void 0 ? { left: -1 / 0, right: 1 / 0, top: -1 / 0, bottom: 1 / 0 } : p, y = n.offset, w = y === void 0 ? { x: 0, y: 0 } : y, _ = { range: f, grid: n, x: null, y: null }, T = 0; T < t.length; T++) {
            var M = t[T], $ = M[0], N = M[1], B = Math.round((l - w.x) / n[$]), ee = Math.round((d - w.y) / n[N]);
            _[$] = Math.max(g.left, Math.min(g.right, B * n[$] + w.x)), _[N] = Math.max(g.top, Math.min(g.bottom, ee * n[N] + w.y));
          }
          return _;
        };
        return o.grid = n, o.coordFields = t, o;
      } }), Cs = { id: "snappers", install: function(n) {
        var t = n.interactStatic;
        t.snappers = A(t.snappers || {}, ws), t.createSnapGrid = t.snappers.grid;
      } }, xs = Cs, Rs = { start: function(n) {
        var t = n.state, o = n.rect, l = n.edges, d = n.pageCoords, f = t.options, p = f.ratio, g = f.enabled, y = t.options, w = y.equalDelta, _ = y.modifiers;
        p === "preserve" && (p = o.width / o.height), t.startCoords = A({}, d), t.startRect = A({}, o), t.ratio = p, t.equalDelta = w;
        var T = t.linkedEdges = { top: l.top || l.left && !l.bottom, left: l.left || l.top && !l.right, bottom: l.bottom || l.right && !l.top, right: l.right || l.bottom && !l.left };
        if (t.xIsPrimaryAxis = !(!l.left && !l.right), t.equalDelta) {
          var M = (T.left ? 1 : -1) * (T.top ? 1 : -1);
          t.edgeSign = { x: M, y: M };
        } else t.edgeSign = { x: T.left ? -1 : 1, y: T.top ? -1 : 1 };
        if (g !== !1 && A(l, T), _ != null && _.length) {
          var $ = new An(n.interaction);
          $.copyFrom(n.interaction.modification), $.prepareStates(_), t.subModification = $, $.startAll(e({}, n));
        }
      }, set: function(n) {
        var t = n.state, o = n.rect, l = n.coords, d = t.linkedEdges, f = A({}, l), p = t.equalDelta ? Ts : Is;
        if (A(n.edges, d), p(t, t.xIsPrimaryAxis, l, o), !t.subModification) return null;
        var g = A({}, o);
        re(d, g, { x: l.x - f.x, y: l.y - f.y });
        var y = t.subModification.setAll(e(e({}, n), {}, { rect: g, edges: d, pageCoords: l, prevCoords: l, prevRect: g })), w = y.delta;
        return y.changed && (p(t, Math.abs(w.x) > Math.abs(w.y), y.coords, y.rect), A(l, y.coords)), y.eventProps;
      }, defaults: { ratio: "preserve", equalDelta: !1, modifiers: [], enabled: !1 } };
      function Ts(n, t, o) {
        var l = n.startCoords, d = n.edgeSign;
        t ? o.y = l.y + (o.x - l.x) * d.y : o.x = l.x + (o.y - l.y) * d.x;
      }
      function Is(n, t, o, l) {
        var d = n.startRect, f = n.startCoords, p = n.ratio, g = n.edgeSign;
        if (t) {
          var y = l.width / p;
          o.y = f.y + (y - d.height) * g.y;
        } else {
          var w = l.height * p;
          o.x = f.x + (w - d.width) * g.x;
        }
      }
      var zs = yt(Rs, "aspectRatio"), Kr = function() {
      };
      Kr._defaults = {};
      var dn = Kr;
      function Tt(n, t, o) {
        return x.func(n) ? Ce(n, t.interactable, t.element, [o.x, o.y, t]) : Ce(n, t.interactable, t.element);
      }
      var fn = { start: function(n) {
        var t = n.rect, o = n.startOffset, l = n.state, d = n.interaction, f = n.pageCoords, p = l.options, g = p.elementRect, y = A({ left: 0, top: 0, right: 0, bottom: 0 }, p.offset || {});
        if (t && g) {
          var w = Tt(p.restriction, d, f);
          if (w) {
            var _ = w.right - w.left - t.width, T = w.bottom - w.top - t.height;
            _ < 0 && (y.left += _, y.right += _), T < 0 && (y.top += T, y.bottom += T);
          }
          y.left += o.left - t.width * g.left, y.top += o.top - t.height * g.top, y.right += o.right - t.width * (1 - g.right), y.bottom += o.bottom - t.height * (1 - g.bottom);
        }
        l.offset = y;
      }, set: function(n) {
        var t = n.coords, o = n.interaction, l = n.state, d = l.options, f = l.offset, p = Tt(d.restriction, o, t);
        if (p) {
          var g = (function(y) {
            return !y || "left" in y && "top" in y || ((y = A({}, y)).left = y.x || 0, y.top = y.y || 0, y.right = y.right || y.left + y.width, y.bottom = y.bottom || y.top + y.height), y;
          })(p);
          t.x = Math.max(Math.min(g.right - f.right, t.x), g.left + f.left), t.y = Math.max(Math.min(g.bottom - f.bottom, t.y), g.top + f.top);
        }
      }, defaults: { restriction: null, elementRect: null, offset: null, endOnly: !1, enabled: !1 } }, Es = yt(fn, "restrict"), Zr = { top: 1 / 0, left: 1 / 0, bottom: -1 / 0, right: -1 / 0 }, Qr = { top: -1 / 0, left: -1 / 0, bottom: 1 / 0, right: 1 / 0 };
      function Jr(n, t) {
        for (var o = 0, l = ["top", "left", "bottom", "right"]; o < l.length; o++) {
          var d = l[o];
          d in n || (n[d] = t[d]);
        }
        return n;
      }
      var Bt = { noInner: Zr, noOuter: Qr, start: function(n) {
        var t, o = n.interaction, l = n.startOffset, d = n.state, f = d.options;
        f && (t = H(Tt(f.offset, o, o.coords.start.page))), t = t || { x: 0, y: 0 }, d.offset = { top: t.y + l.top, left: t.x + l.left, bottom: t.y - l.bottom, right: t.x - l.right };
      }, set: function(n) {
        var t = n.coords, o = n.edges, l = n.interaction, d = n.state, f = d.offset, p = d.options;
        if (o) {
          var g = A({}, t), y = Tt(p.inner, l, g) || {}, w = Tt(p.outer, l, g) || {};
          Jr(y, Zr), Jr(w, Qr), o.top ? t.y = Math.min(Math.max(w.top + f.top, g.y), y.top + f.top) : o.bottom && (t.y = Math.max(Math.min(w.bottom + f.bottom, g.y), y.bottom + f.bottom)), o.left ? t.x = Math.min(Math.max(w.left + f.left, g.x), y.left + f.left) : o.right && (t.x = Math.max(Math.min(w.right + f.right, g.x), y.right + f.right));
        }
      }, defaults: { inner: null, outer: null, offset: null, endOnly: !1, enabled: !1 } }, Os = yt(Bt, "restrictEdges"), Ps = A({ get elementRect() {
        return { top: 0, left: 0, bottom: 1, right: 1 };
      }, set elementRect(n) {
      } }, fn.defaults), Ms = yt({ start: fn.start, set: fn.set, defaults: Ps }, "restrictRect"), As = { width: -1 / 0, height: -1 / 0 }, ks = { width: 1 / 0, height: 1 / 0 }, Ds = yt({ start: function(n) {
        return Bt.start(n);
      }, set: function(n) {
        var t = n.interaction, o = n.state, l = n.rect, d = n.edges, f = o.options;
        if (d) {
          var p = J(Tt(f.min, t, n.coords)) || As, g = J(Tt(f.max, t, n.coords)) || ks;
          o.options = { endOnly: f.endOnly, inner: A({}, Bt.noInner), outer: A({}, Bt.noOuter) }, d.top ? (o.options.inner.top = l.bottom - p.height, o.options.outer.top = l.bottom - g.height) : d.bottom && (o.options.inner.bottom = l.top + p.height, o.options.outer.bottom = l.top + g.height), d.left ? (o.options.inner.left = l.right - p.width, o.options.outer.left = l.right - g.width) : d.right && (o.options.inner.right = l.left + p.width, o.options.outer.right = l.left + g.width), Bt.set(n), o.options = f;
        }
      }, defaults: { min: null, max: null, endOnly: !1, enabled: !1 } }, "restrictSize"), jn = { start: function(n) {
        var t, o = n.interaction, l = n.interactable, d = n.element, f = n.rect, p = n.state, g = n.startOffset, y = p.options, w = y.offsetWithOrigin ? (function(M) {
          var $ = M.interaction.element, N = H(Ce(M.state.options.origin, null, null, [$])), B = N || ue(M.interactable, $, M.interaction.prepared.name);
          return B;
        })(n) : { x: 0, y: 0 };
        if (y.offset === "startCoords") t = { x: o.coords.start.page.x, y: o.coords.start.page.y };
        else {
          var _ = Ce(y.offset, l, d, [o]);
          (t = H(_) || { x: 0, y: 0 }).x += w.x, t.y += w.y;
        }
        var T = y.relativePoints;
        p.offsets = f && T && T.length ? T.map((function(M, $) {
          return { index: $, relativePoint: M, x: g.left - f.width * M.x + t.x, y: g.top - f.height * M.y + t.y };
        })) : [{ index: 0, relativePoint: null, x: t.x, y: t.y }];
      }, set: function(n) {
        var t = n.interaction, o = n.coords, l = n.state, d = l.options, f = l.offsets, p = ue(t.interactable, t.element, t.prepared.name), g = A({}, o), y = [];
        d.offsetWithOrigin || (g.x -= p.x, g.y -= p.y);
        for (var w = 0, _ = f; w < _.length; w++) for (var T = _[w], M = g.x - T.x, $ = g.y - T.y, N = 0, B = d.targets.length; N < B; N++) {
          var ee = d.targets[N], K = void 0;
          (K = x.func(ee) ? ee(M, $, t._proxy, T, N) : ee) && y.push({ x: (x.number(K.x) ? K.x : M) + T.x, y: (x.number(K.y) ? K.y : $) + T.y, range: x.number(K.range) ? K.range : d.range, source: ee, index: N, offset: T });
        }
        for (var ae = { target: null, inRange: !1, distance: 0, range: 0, delta: { x: 0, y: 0 } }, _e = 0; _e < y.length; _e++) {
          var xe = y[_e], ge = xe.range, be = xe.x - g.x, qe = xe.y - g.y, ke = Ne(be, qe), et = ke <= ge;
          ge === 1 / 0 && ae.inRange && ae.range !== 1 / 0 && (et = !1), ae.target && !(et ? ae.inRange && ge !== 1 / 0 ? ke / ge < ae.distance / ae.range : ge === 1 / 0 && ae.range !== 1 / 0 || ke < ae.distance : !ae.inRange && ke < ae.distance) || (ae.target = xe, ae.distance = ke, ae.range = ge, ae.inRange = et, ae.delta.x = be, ae.delta.y = qe);
        }
        return ae.inRange && (o.x = ae.target.x, o.y = ae.target.y), l.closest = ae, ae;
      }, defaults: { range: 1 / 0, targets: null, offset: null, offsetWithOrigin: !0, origin: null, relativePoints: null, endOnly: !1, enabled: !1 } }, Ls = yt(jn, "snap"), hn = { start: function(n) {
        var t = n.state, o = n.edges, l = t.options;
        if (!o) return null;
        n.state = { options: { targets: null, relativePoints: [{ x: o.left ? 0 : 1, y: o.top ? 0 : 1 }], offset: l.offset || "self", origin: { x: 0, y: 0 }, range: l.range } }, t.targetFields = t.targetFields || [["width", "height"], ["x", "y"]], jn.start(n), t.offsets = n.state.offsets, n.state = t;
      }, set: function(n) {
        var t = n.interaction, o = n.state, l = n.coords, d = o.options, f = o.offsets, p = { x: l.x - f[0].x, y: l.y - f[0].y };
        o.options = A({}, d), o.options.targets = [];
        for (var g = 0, y = d.targets || []; g < y.length; g++) {
          var w = y[g], _ = void 0;
          if (_ = x.func(w) ? w(p.x, p.y, t) : w) {
            for (var T = 0, M = o.targetFields; T < M.length; T++) {
              var $ = M[T], N = $[0], B = $[1];
              if (N in _ || B in _) {
                _.x = _[N], _.y = _[B];
                break;
              }
            }
            o.options.targets.push(_);
          }
        }
        var ee = jn.set(n);
        return o.options = d, ee;
      }, defaults: { range: 1 / 0, targets: null, offset: null, endOnly: !1, enabled: !1 } }, Gs = yt(hn, "snapSize"), Fn = { aspectRatio: zs, restrictEdges: Os, restrict: Es, restrictRect: Ms, restrictSize: Ds, snapEdges: yt({ start: function(n) {
        var t = n.edges;
        return t ? (n.state.targetFields = n.state.targetFields || [[t.left ? "left" : "right", t.top ? "top" : "bottom"]], hn.start(n)) : null;
      }, set: hn.set, defaults: A(At(hn.defaults), { targets: void 0, range: void 0, offset: { x: 0, y: 0 } }) }, "snapEdges"), snap: Ls, snapSize: Gs, spring: dn, avoid: dn, transform: dn, rubberband: dn }, Ws = { id: "modifiers", install: function(n) {
        var t = n.interactStatic;
        for (var o in n.usePlugin(Dr), n.usePlugin(xs), t.modifiers = Fn, Fn) {
          var l = Fn[o], d = l._defaults, f = l._methods;
          d._methods = f, n.defaults.perAction[o] = d;
        }
      } }, js = Ws, ei = (function(n) {
        m(o, n);
        var t = R(o);
        function o(l, d, f, p, g, y) {
          var w;
          if (c(this, o), we(C(w = t.call(this, g)), f), f !== d && we(C(w), d), w.timeStamp = y, w.originalEvent = f, w.type = l, w.pointerId = Le(d), w.pointerType = mr(d), w.target = p, w.currentTarget = null, l === "tap") {
            var _ = g.getPointerIndex(d);
            w.dt = w.timeStamp - g.pointers[_].downTime;
            var T = w.timeStamp - g.tapTime;
            w.double = !!g.prevTap && g.prevTap.type !== "doubletap" && g.prevTap.target === w.target && T < 500;
          } else l === "doubletap" && (w.dt = d.timeStamp - g.tapTime, w.double = !0);
          return w;
        }
        return h(o, [{ key: "_subtractOrigin", value: function(l) {
          var d = l.x, f = l.y;
          return this.pageX -= d, this.pageY -= f, this.clientX -= d, this.clientY -= f, this;
        } }, { key: "_addOrigin", value: function(l) {
          var d = l.x, f = l.y;
          return this.pageX += d, this.pageY += f, this.clientX += d, this.clientY += f, this;
        } }, { key: "preventDefault", value: function() {
          this.originalEvent.preventDefault();
        } }]), o;
      })(on), qt = { id: "pointer-events/base", before: ["inertia", "modifiers", "auto-start", "actions"], install: function(n) {
        n.pointerEvents = qt, n.defaults.actions.pointerEvents = qt.defaults, A(n.actions.phaselessTypes, qt.types);
      }, listeners: { "interactions:new": function(n) {
        var t = n.interaction;
        t.prevTap = null, t.tapTime = 0;
      }, "interactions:update-pointer": function(n) {
        var t = n.down, o = n.pointerInfo;
        !t && o.hold || (o.hold = { duration: 1 / 0, timeout: null });
      }, "interactions:move": function(n, t) {
        var o = n.interaction, l = n.pointer, d = n.event, f = n.eventTarget;
        n.duplicate || o.pointerIsDown && !o.pointerWasMoved || (o.pointerIsDown && Nn(n), _t({ interaction: o, pointer: l, event: d, eventTarget: f, type: "move" }, t));
      }, "interactions:down": function(n, t) {
        (function(o, l) {
          for (var d = o.interaction, f = o.pointer, p = o.event, g = o.eventTarget, y = o.pointerIndex, w = d.pointers[y].hold, _ = ne(g), T = { interaction: d, pointer: f, event: p, eventTarget: g, type: "hold", targets: [], path: _, node: null }, M = 0; M < _.length; M++) {
            var $ = _[M];
            T.node = $, l.fire("pointerEvents:collect-targets", T);
          }
          if (T.targets.length) {
            for (var N = 1 / 0, B = 0, ee = T.targets; B < ee.length; B++) {
              var K = ee[B].eventable.options.holdDuration;
              K < N && (N = K);
            }
            w.duration = N, w.timeout = setTimeout((function() {
              _t({ interaction: d, eventTarget: g, pointer: f, event: p, type: "hold" }, l);
            }), N);
          }
        })(n, t), _t(n, t);
      }, "interactions:up": function(n, t) {
        Nn(n), _t(n, t), (function(o, l) {
          var d = o.interaction, f = o.pointer, p = o.event, g = o.eventTarget;
          d.pointerWasMoved || _t({ interaction: d, eventTarget: g, pointer: f, event: p, type: "tap" }, l);
        })(n, t);
      }, "interactions:cancel": function(n, t) {
        Nn(n), _t(n, t);
      } }, PointerEvent: ei, fire: _t, collectEventTargets: ti, defaults: { holdDuration: 600, ignoreFrom: null, allowFrom: null, origin: { x: 0, y: 0 } }, types: { down: !0, move: !0, up: !0, cancel: !0, tap: !0, doubletap: !0, hold: !0 } };
      function _t(n, t) {
        var o = n.interaction, l = n.pointer, d = n.event, f = n.eventTarget, p = n.type, g = n.targets, y = g === void 0 ? ti(n, t) : g, w = new ei(p, l, d, f, o, t.now());
        t.fire("pointerEvents:new", { pointerEvent: w });
        for (var _ = { interaction: o, pointer: l, event: d, eventTarget: f, targets: y, type: p, pointerEvent: w }, T = 0; T < y.length; T++) {
          var M = y[T];
          for (var $ in M.props || {}) w[$] = M.props[$];
          var N = ue(M.eventable, M.node);
          if (w._subtractOrigin(N), w.eventable = M.eventable, w.currentTarget = M.node, M.eventable.fire(w), w._addOrigin(N), w.immediatePropagationStopped || w.propagationStopped && T + 1 < y.length && y[T + 1].node !== w.currentTarget) break;
        }
        if (t.fire("pointerEvents:fired", _), p === "tap") {
          var B = w.double ? _t({ interaction: o, pointer: l, event: d, eventTarget: f, type: "doubletap" }, t) : w;
          o.prevTap = B, o.tapTime = B.timeStamp;
        }
        return w;
      }
      function ti(n, t) {
        var o = n.interaction, l = n.pointer, d = n.event, f = n.eventTarget, p = n.type, g = o.getPointerIndex(l), y = o.pointers[g];
        if (p === "tap" && (o.pointerWasMoved || !y || y.downTarget !== f)) return [];
        for (var w = ne(f), _ = { interaction: o, pointer: l, event: d, eventTarget: f, type: p, path: w, targets: [], node: null }, T = 0; T < w.length; T++) {
          var M = w[T];
          _.node = M, t.fire("pointerEvents:collect-targets", _);
        }
        return p === "hold" && (_.targets = _.targets.filter((function($) {
          var N, B;
          return $.eventable.options.holdDuration === ((N = o.pointers[g]) == null || (B = N.hold) == null ? void 0 : B.duration);
        }))), _.targets;
      }
      function Nn(n) {
        var t = n.interaction, o = n.pointerIndex, l = t.pointers[o].hold;
        l && l.timeout && (clearTimeout(l.timeout), l.timeout = null);
      }
      var Fs = Object.freeze({ __proto__: null, default: qt });
      function Ns(n) {
        var t = n.interaction;
        t.holdIntervalHandle && (clearInterval(t.holdIntervalHandle), t.holdIntervalHandle = null);
      }
      var Hs = { id: "pointer-events/holdRepeat", install: function(n) {
        n.usePlugin(qt);
        var t = n.pointerEvents;
        t.defaults.holdRepeatInterval = 0, t.types.holdrepeat = n.actions.phaselessTypes.holdrepeat = !0;
      }, listeners: ["move", "up", "cancel", "endall"].reduce((function(n, t) {
        return n["pointerEvents:".concat(t)] = Ns, n;
      }), { "pointerEvents:new": function(n) {
        var t = n.pointerEvent;
        t.type === "hold" && (t.count = (t.count || 0) + 1);
      }, "pointerEvents:fired": function(n, t) {
        var o = n.interaction, l = n.pointerEvent, d = n.eventTarget, f = n.targets;
        if (l.type === "hold" && f.length) {
          var p = f[0].eventable.options.holdRepeatInterval;
          p <= 0 || (o.holdIntervalHandle = setTimeout((function() {
            t.pointerEvents.fire({ interaction: o, eventTarget: d, type: "hold", pointer: l, event: l }, t);
          }), p));
        }
      } }) }, $s = Hs, Us = { id: "pointer-events/interactableTargets", install: function(n) {
        var t = n.Interactable;
        t.prototype.pointerEvents = function(l) {
          return A(this.events.options, l), this;
        };
        var o = t.prototype._backCompatOption;
        t.prototype._backCompatOption = function(l, d) {
          var f = o.call(this, l, d);
          return f === this && (this.events.options[l] = d), f;
        };
      }, listeners: { "pointerEvents:collect-targets": function(n, t) {
        var o = n.targets, l = n.node, d = n.type, f = n.eventTarget;
        t.interactables.forEachMatch(l, (function(p) {
          var g = p.events, y = g.options;
          g.types[d] && g.types[d].length && p.testIgnoreAllow(y, l, f) && o.push({ node: l, eventable: g, props: { interactable: p } });
        }));
      }, "interactable:new": function(n) {
        var t = n.interactable;
        t.events.getRect = function(o) {
          return t.getRect(o);
        };
      }, "interactable:set": function(n, t) {
        var o = n.interactable, l = n.options;
        A(o.events.options, t.pointerEvents.defaults), A(o.events.options, l.pointerEvents || {});
      } } }, Bs = Us, qs = { id: "pointer-events", install: function(n) {
        n.usePlugin(Fs), n.usePlugin($s), n.usePlugin(Bs);
      } }, Vs = qs, Xs = { id: "reflow", install: function(n) {
        var t = n.Interactable;
        n.actions.phases.reflow = !0, t.prototype.reflow = function(o) {
          return (function(l, d, f) {
            for (var p = l.getAllElements(), g = f.window.Promise, y = g ? [] : null, w = function() {
              var T = p[_], M = l.getRect(T);
              if (!M) return 1;
              var $, N = Nt(f.interactions.list, (function(K) {
                return K.interacting() && K.interactable === l && K.element === T && K.prepared.name === d.name;
              }));
              if (N) N.move(), y && ($ = N._reflowPromise || new g((function(K) {
                N._reflowResolve = K;
              })));
              else {
                var B = J(M), ee = /* @__PURE__ */ (function(K) {
                  return { coords: K, get page() {
                    return this.coords.page;
                  }, get client() {
                    return this.coords.client;
                  }, get timeStamp() {
                    return this.coords.timeStamp;
                  }, get pageX() {
                    return this.coords.page.x;
                  }, get pageY() {
                    return this.coords.page.y;
                  }, get clientX() {
                    return this.coords.client.x;
                  }, get clientY() {
                    return this.coords.client.y;
                  }, get pointerId() {
                    return this.coords.pointerId;
                  }, get target() {
                    return this.coords.target;
                  }, get type() {
                    return this.coords.type;
                  }, get pointerType() {
                    return this.coords.pointerType;
                  }, get buttons() {
                    return this.coords.buttons;
                  }, preventDefault: function() {
                  } };
                })({ page: { x: B.x, y: B.y }, client: { x: B.x, y: B.y }, timeStamp: f.now() });
                $ = (function(K, ae, _e, xe, ge) {
                  var be = K.interactions.new({ pointerType: "reflow" }), qe = { interaction: be, event: ge, pointer: ge, eventTarget: _e, phase: "reflow" };
                  be.interactable = ae, be.element = _e, be.prevEvent = ge, be.updatePointer(ge, ge, _e, !0), De(be.coords.delta), En(be.prepared, xe), be._doPhase(qe);
                  var ke = K.window, et = ke.Promise, nt = et ? new et((function(ht) {
                    be._reflowResolve = ht;
                  })) : void 0;
                  return be._reflowPromise = nt, be.start(xe, ae, _e), be._interacting ? (be.move(qe), be.end(ge)) : (be.stop(), be._reflowResolve()), be.removePointer(ge, ge), nt;
                })(f, l, T, d, ee);
              }
              y && y.push($);
            }, _ = 0; _ < p.length && !w(); _++) ;
            return y && g.all(y).then((function() {
              return l;
            }));
          })(this, o, n);
        };
      }, listeners: { "interactions:stop": function(n, t) {
        var o = n.interaction;
        o.pointerType === "reflow" && (o._reflowResolve && o._reflowResolve(), (function(l, d) {
          l.splice(l.indexOf(d), 1);
        })(t.interactions.list, o));
      } } }, Ys = Xs;
      if (Be.use(kr), Be.use(Fr), Be.use(Vs), Be.use(fs), Be.use(js), Be.use(es), Be.use($o), Be.use(Bo), Be.use(Ys), Be.default = Be, a(s) === "object" && s) try {
        s.exports = Be;
      } catch {
      }
      return Be.default = Be, Be;
    }));
  })(Zt, Zt.exports)), Zt.exports;
}
var nc = /* @__PURE__ */ tc();
const rc = /* @__PURE__ */ no(nc), ic = ({ children: s, interactRef: i, draggable: r, resizable: e, draggableOptions: a, resizableOptions: c }) => {
  const u = Ae(null), h = Ae(), v = Ae(), m = Ae();
  Qe(() => {
    v.current = { ...a }, m.current = { ...c };
  }, [a, c]), Qe(() => {
    h.current && h.current.unset(), h.current = rc(u.current), i.current = h.current, S();
  }, [r, e]);
  const S = () => {
    r && h.current?.draggable({
      ...v.current,
      onstart: (b) => v.current?.onstart && v.current.onstart(b),
      onmove: (b) => v.current?.onmove && v.current.onmove(b),
      onend: (b) => v.current?.onend && v.current.onend(b)
    }), e && h.current?.resizable({
      ...m.current,
      onstart: (b) => m.current?.onstart && m.current.onstart(b),
      onmove: (b) => m.current?.onmove && m.current.onmove(b),
      onend: (b) => m.current?.onend && m.current.onend(b)
    });
  };
  return Bi(s, {
    ref: u,
    draggable: !1
  });
}, Wo = Jt.forwardRef(
  ({
    children: s,
    edges: i,
    left: r,
    width: e,
    start: a = Lo,
    grid: c = nr,
    bounds: u = {
      left: Number.MIN_SAFE_INTEGER,
      right: Number.MAX_SAFE_INTEGER
    },
    enableResizing: h = !0,
    enableDragging: v = !0,
    adsorptionDistance: m = rr,
    adsorptionPositions: S = [],
    onResizeStart: b,
    onResize: C,
    onResizeEnd: R,
    onDragStart: z,
    onDragEnd: E,
    onDrag: k,
    parentRef: L,
    deltaScrollLeft: q
  }, P) => {
    const W = Ae(null), I = Ae(0), V = Ae(!1), { initAutoScroll: x, dealDragAutoScroll: j, dealResizeAutoScroll: ie, stopAutoScroll: te } = Jl(L);
    Qe(() => () => {
      W.current && W.current.unset();
    }, []), ar(P, () => ({
      updateLeft: (U) => Q(U || 0, !1),
      updateWidth: (U) => ce(U, !1),
      getLeft: de,
      getWidth: he
    })), Qe(() => {
      const U = W.current?.target;
      ce(typeof e > "u" ? U.offsetWidth : e, !1);
    }, [e]), Qe(() => {
      Q(r || 0, !1);
    }, [r]);
    const Q = (U, X = !0) => {
      if (!W.current || !W.current.target) return;
      X && (I.current = 0);
      const Y = W.current.target;
      Y.style.left = `${U}px`, Object.assign(Y.dataset, { left: U });
    }, ce = (U, X = !0) => {
      if (!W.current || !W.current.target) return;
      X && (I.current = 0);
      const Y = W.current.target;
      Y.style.width = `${U}px`, Object.assign(Y.dataset, { width: U });
    }, de = () => {
      const U = W.current?.target;
      return parseFloat(U?.dataset?.left || "0");
    }, he = () => {
      const U = W.current?.target;
      return parseFloat(U?.dataset?.width || "0");
    }, pe = (U) => {
      I.current = 0, V.current = !1, x(), z && z();
    }, Se = (U) => {
      const { preLeft: X, preWidth: Y, scrollDelta: Z } = U, ne = V.current ? m : c;
      if (Math.abs(I.current) >= ne) {
        const fe = parseInt(I.current / ne + "");
        let A = X + fe * ne, se = A, Ce = Number.MAX_SAFE_INTEGER;
        if (S.forEach((H) => {
          const J = Math.abs(H - A);
          J < m && J < Ce && (se = H);
          const re = Math.abs(H - (A + Y));
          re < m && re < Ce && (se = H - Y);
        }), se !== A ? (V.current = !0, A = se) : ((A - a) % c !== 0 && (A = a + c * Math.round((A - a) / c)), V.current = !1), I.current = I.current % ne, A < u.left ? A = u.left : A + Y > u.right && (A = u.right - Y), k && k(
          {
            lastLeft: X,
            left: A,
            lastWidth: Y,
            width: Y
          },
          Z
        ) === !1)
          return;
        Q(A, !1);
      }
    }, Te = (U) => {
      const X = U.target;
      if (q && L?.current && !j(U, (se) => {
        q(se);
        let { left: Ce, width: H } = X.dataset;
        const J = parseFloat(Ce || "0"), re = parseFloat(H || "0");
        I.current += se, Se({ preLeft: J, preWidth: re, scrollDelta: se });
      }))
        return;
      let { left: Y, width: Z } = X.dataset;
      const ne = parseFloat(Y || "0"), fe = parseFloat(Z || "0");
      I.current += U.dx, Se({ preLeft: ne, preWidth: fe });
    }, Fe = (U) => {
      I.current = 0, V.current = !1, te();
      const X = U.target;
      let { left: Y, width: Z } = X.dataset;
      E && E({ left: parseFloat(Y || "0"), width: parseFloat(Z || "0") });
    }, Re = (U) => {
      I.current = 0, V.current = !1, x();
      let X = U.edges?.right ? "right" : "left";
      b && b(X);
    }, G = (U) => {
      const { dir: X, preWidth: Y, preLeft: Z } = U, ne = V.current ? m : c;
      if (X === "left") {
        if (Math.abs(I.current) >= ne) {
          const fe = parseInt(I.current / ne + "");
          let A = Z + fe * ne, se = A, Ce = Number.MAX_SAFE_INTEGER;
          S.forEach((re) => {
            const ue = Math.abs(re - A);
            ue < m && ue < Ce && (se = re);
          }), se !== A ? (V.current = !0, A = se) : ((A - a) % c !== 0 && (A = a + c * Math.round((A - a) / c)), V.current = !1), I.current = I.current % ne;
          const H = Z + Y;
          A < u.left && (A = u.left);
          const J = H - A;
          if (C && C("left", {
            lastLeft: Z,
            lastWidth: Y,
            left: A,
            width: J
          }) === !1)
            return;
          Q(A, !1), ce(J, !1);
        }
      } else if (X === "right" && Math.abs(I.current) >= ne) {
        const fe = parseInt(I.current / c + "");
        let A = Y + fe * c, se = Z + A, Ce = Number.MAX_SAFE_INTEGER;
        if (S.forEach((H) => {
          const J = Math.abs(H - (Z + A));
          J < m && J < Ce && (se = H);
        }), se !== Z + A)
          V.current = !0, A = se - Z;
        else {
          let H = Z + A;
          (H - a) % c !== 0 && (H = a + c * Math.round((H - a) / c), A = H - Z), V.current = !1;
        }
        if (I.current = I.current % ne, Z + A > u.right && (A = u.right - Z), C && C("right", {
          lastLeft: Z,
          lastWidth: Y,
          left: Z,
          width: A
        }) === !1)
          return;
        ce(A, !1);
      }
    }, F = (U) => {
      const X = U.target, Y = U.edges?.left ? "left" : "right";
      if (q && L?.current && !ie(U, Y, (Ce) => {
        q(Ce);
        let { left: H, width: J } = X.dataset;
        const re = parseFloat(H || "0"), ue = parseFloat(J || "0");
        I.current += Ce, G({ preLeft: re, preWidth: ue, dir: Y });
      }))
        return;
      let { left: Z, width: ne } = X.dataset;
      const fe = parseFloat(Z || "0"), A = parseFloat(ne || "0");
      I.current += Y === "left" ? U.deltaRect?.left || 0 : U.deltaRect?.right || 0, G({ preLeft: fe, preWidth: A, dir: Y });
    }, oe = (U) => {
      I.current = 0, V.current = !1, te();
      const X = U.target;
      let { left: Y, width: Z } = X.dataset, ne = U.edges?.right ? "right" : "left";
      R && R(ne, {
        left: parseFloat(Y || "0"),
        width: parseFloat(Z || "0")
      });
    };
    return /* @__PURE__ */ Ee(
      ic,
      {
        interactRef: W,
        draggable: v,
        resizable: h,
        draggableOptions: {
          lockAxis: "x",
          onmove: Te,
          onstart: pe,
          onend: Fe,
          cursorChecker: () => ""
        },
        resizableOptions: {
          axis: "x",
          invert: "none",
          edges: {
            left: !0,
            right: !0,
            top: !1,
            bottom: !1,
            ...i || {}
          },
          onmove: F,
          onstart: Re,
          onend: oe
        },
        children: Jt.cloneElement(s, {
          style: {
            ...s.props.style || {},
            left: r,
            width: e
          }
        })
      }
    );
  }
), oc = ({
  disableDrag: s,
  cursorTime: i,
  setCursor: r,
  startLeft: e,
  timelineWidth: a,
  scaleWidth: c,
  scale: u,
  scrollLeft: h,
  scrollSync: v,
  areaRef: m,
  maxScaleCount: S,
  deltaScrollLeft: b,
  onCursorDragStart: C,
  onCursorDrag: R,
  onCursorDragEnd: z
}) => {
  const E = Ae(null), k = Ae();
  return Qe(() => {
    typeof k.current > "u" && E.current?.updateLeft(ct(i, { startLeft: e, scaleWidth: c, scale: u }) - h);
  }, [i, e, c, u, h]), /* @__PURE__ */ Ee(
    Wo,
    {
      start: e,
      ref: E,
      parentRef: m,
      bounds: {
        left: 0,
        right: Math.min(a, S * c + e - h)
      },
      deltaScrollLeft: b,
      enableDragging: !s,
      enableResizing: !1,
      onDragStart: () => {
        C && C(i), k.current = ct(i, { startLeft: e, scaleWidth: c, scale: u }) - h, E.current?.updateLeft(k.current);
      },
      onDragEnd: () => {
        const L = Pt((k.current || 0) + h, { startLeft: e, scale: u, scaleWidth: c });
        r({ time: L }), z && z(L), k.current = void 0;
      },
      onDrag: ({ left: L }, q = 0) => {
        const P = v.current?.state.scrollLeft || 0;
        !q || P === 0 ? L < e - P ? k.current = e - P : k.current = L : (k.current || 0) < e - P - q && (k.current = e - P - q), E.current?.updateLeft(k.current || 0);
        const W = Pt((k.current || 0) + P, { startLeft: e, scale: u, scaleWidth: c });
        return r({ time: W }), R && R(W), !1;
      },
      children: /* @__PURE__ */ Et("div", { className: je("cursor"), children: [
        /* @__PURE__ */ Ee("svg", { className: je("cursor-top"), width: "8", height: "12", viewBox: "0 0 8 12", fill: "none", children: /* @__PURE__ */ Ee(
          "path",
          {
            d: "M0 1C0 0.447715 0.447715 0 1 0H7C7.55228 0 8 0.447715 8 1V9.38197C8 9.76074 7.786 10.107 7.44721 10.2764L4.44721 11.7764C4.16569 11.9172 3.83431 11.9172 3.55279 11.7764L0.552786 10.2764C0.214002 10.107 0 9.76074 0 9.38197V1Z",
            fill: "#5297FF"
          }
        ) }),
        /* @__PURE__ */ Ee("div", { className: je("cursor-area") })
      ] })
    }
  );
}, sc = ({
  isMoving: s,
  movePositions: i = [],
  assistPositions: r = [],
  scrollLeft: e
}) => /* @__PURE__ */ Ee("div", { className: je("drag-line-container"), children: s && i.filter((a) => r.includes(a)).map(((a, c) => /* @__PURE__ */ Ee("div", { className: je("drag-line"), style: { left: a - e } }, c))) }), ac = ({
  editorData: s,
  row: i,
  action: r,
  effects: e,
  rowHeight: a,
  scale: c,
  scaleWidth: u,
  scaleSplitCount: h,
  startLeft: v,
  gridSnap: m,
  disableDrag: S,
  scaleCount: b,
  maxScaleCount: C,
  setScaleCount: R,
  onActionMoveStart: z,
  onActionMoving: E,
  onActionMoveEnd: k,
  onActionResizeStart: L,
  onActionResizeEnd: q,
  onActionResizing: P,
  dragLineData: W,
  setEditorData: I,
  onClickAction: V,
  onClickActionOnly: x,
  onDoubleClickAction: j,
  onContextMenuAction: ie,
  getActionRender: te,
  handleTime: Q,
  areaRef: ce,
  deltaScrollLeft: de
}) => {
  const he = Ae(null), pe = Ae(!1), { id: Se, maxEnd: Te, minStart: Fe, end: Re, start: G, selected: F, flexible: oe = !0, movable: U = !0, effectId: X } = r, Y = ct(Fe || 0, {
    startLeft: v,
    scale: c,
    scaleWidth: u
  }), Z = Math.min(
    C * u + v,
    // 根据maxScaleCount限制移动范围
    ct(Te || Number.MAX_VALUE, {
      startLeft: v,
      scale: c,
      scaleWidth: u
    })
  ), [ne, fe] = wt(() => or({ start: G, end: Re }, { startLeft: v, scale: c, scaleWidth: u }));
  lr(() => {
    fe(or({ start: G, end: Re }, { startLeft: v, scale: c, scaleWidth: u }));
  }, [Re, G, v, u, c]);
  const A = u / h, se = ["action"];
  U && se.push("action-movable"), F && se.push("action-selected"), oe && se.push("action-flexible"), e[X] && se.push(`action-effect-${X}`);
  const Ce = (we, Ie) => {
    const De = Kl(we + Ie, {
      startLeft: v,
      scaleCount: b,
      scaleWidth: u
    });
    De !== b && R(De);
  }, H = () => {
    z && z({ action: r, row: i });
  }, J = ({ left: we, width: Ie }) => {
    if (pe.current = !0, E) {
      const { start: De, end: He } = Xt({ left: we, width: Ie }, { scaleWidth: u, scale: c, startLeft: v });
      if (E({ action: r, row: i, start: De, end: He }) === !1) return !1;
    }
    fe({ left: we, width: Ie }), Ce(we, Ie);
  }, re = ({ left: we, width: Ie }) => {
    const { start: De, end: He } = Xt({ left: we, width: Ie }, { scaleWidth: u, scale: c, startLeft: v }), $e = s.find((Le) => Le.id === i.id);
    if (!$e) return;
    const Ke = $e.actions.find((Le) => Le.id === Se);
    Ke && (Ke.start = De, Ke.end = He, I(s), k && k({ action: Ke, row: i, start: De, end: He }));
  }, ue = (we) => {
    L && L({ action: r, row: i, dir: we });
  }, me = (we, { left: Ie, width: De }) => {
    if (pe.current = !0, P) {
      const { start: He, end: $e } = Xt({ left: Ie, width: De }, { scaleWidth: u, scale: c, startLeft: v });
      if (P({ action: r, row: i, start: He, end: $e, dir: we }) === !1) return !1;
    }
    fe({ left: Ie, width: De }), Ce(Ie, De);
  }, ve = (we, { left: Ie, width: De }) => {
    const { start: He, end: $e } = Xt({ left: Ie, width: De }, { scaleWidth: u, scale: c, startLeft: v }), Ke = s.find((Ue) => Ue.id === i.id);
    if (!Ke) return;
    const Le = Ke.actions.find((Ue) => Ue.id === Se);
    Le && (Le.start = He, Le.end = $e, I(s), q && q({ action: Le, row: i, start: He, end: $e, dir: we }));
  }, Ne = {
    ...r,
    ...Xt({ left: ne.left, width: ne.width }, { startLeft: v, scaleWidth: u, scale: c })
  }, gt = {
    ...i,
    actions: [...i.actions]
  };
  return i.actions.includes(r) && (gt.actions[i.actions.indexOf(r)] = Ne), /* @__PURE__ */ Ee(
    Wo,
    {
      ref: he,
      parentRef: ce,
      start: v,
      left: ne.left,
      width: ne.width,
      grid: m && A || nr,
      adsorptionDistance: m ? Math.max((A || nr) / 2, rr) : rr,
      adsorptionPositions: W.assistPositions,
      bounds: {
        left: Y,
        right: Z
      },
      edges: {
        left: !S && oe && `.${je("action-left-stretch")}`,
        right: !S && oe && `.${je("action-right-stretch")}`
      },
      enableDragging: !S && U,
      enableResizing: !S && oe,
      onDragStart: H,
      onDrag: J,
      onDragEnd: re,
      onResizeStart: ue,
      onResize: me,
      onResizeEnd: ve,
      deltaScrollLeft: de,
      children: /* @__PURE__ */ Et(
        "div",
        {
          onMouseDown: () => {
            pe.current = !1;
          },
          onClick: (we) => {
            let Ie;
            V && (Ie = Q(we), V(we, { row: i, action: r, time: Ie })), !pe.current && x && (Ie || (Ie = Q(we)), x(we, { row: i, action: r, time: Ie }));
          },
          onDoubleClick: (we) => {
            if (j) {
              const Ie = Q(we);
              j(we, { row: i, action: r, time: Ie });
            }
          },
          onContextMenu: (we) => {
            if (ie) {
              const Ie = Q(we);
              ie(we, { row: i, action: r, time: Ie });
            }
          },
          className: je((se || []).join(" ")),
          style: { height: a },
          children: [
            te && te(Ne, gt),
            oe && /* @__PURE__ */ Ee("div", { className: je("action-left-stretch") }),
            oe && /* @__PURE__ */ Ee("div", { className: je("action-right-stretch") })
          ]
        }
      )
    }
  );
}, lc = (s) => {
  const { rowData: i, style: r = {}, onClickRow: e, onDoubleClickRow: a, onContextMenuRow: c, areaRef: u, scrollLeft: h, startLeft: v, scale: m, scaleWidth: S, enableRowDrag: b, onRowDragStart: C, rowIndex: R = -1, dragState: z } = s, E = ["edit-row"];
  i?.selected && E.push("edit-row-selected"), z?.isDragging && z.draggedIndex === R && E.push("edit-row-dragging");
  const k = Ae(null), L = (P) => {
    if (!u.current) return 0;
    const W = u.current.getBoundingClientRect(), V = P.clientX - W.x + h;
    return Pt(V, { startLeft: v, scale: m, scaleWidth: S });
  }, q = pt(
    (P) => {
      !b || !i || R === -1 || (P.preventDefault(), P.stopPropagation(), C?.({ row: i }));
    },
    [b, i, R, C]
  );
  return /* @__PURE__ */ Et(
    "div",
    {
      className: `${je(...E)} ${(i?.classNames || []).join(" ")}`,
      style: r,
      onClick: (P) => {
        if (i && e) {
          const W = L(P);
          e(P, { row: i, time: W });
        }
      },
      onDoubleClick: (P) => {
        if (i && a) {
          const W = L(P);
          a(P, { row: i, time: W });
        }
      },
      onContextMenu: (P) => {
        if (i && c) {
          const W = L(P);
          c(P, { row: i, time: W });
        }
      },
      children: [
        b && i && /* @__PURE__ */ Ee("div", { ref: k, className: je("edit-row-drag-handle"), onMouseDown: q, title: "拖拽调整行顺序", children: "⋮⋮" }),
        (i?.actions || []).map((P) => /* @__PURE__ */ Ee(ac, { ...s, handleTime: L, row: i, action: P }, P.id))
      ]
    }
  );
};
function cc() {
  const [s, i] = wt({ isMoving: !1, movePositions: [], assistPositions: [] });
  return {
    initDragLine: (h) => {
      const { movePositions: v, assistPositions: m } = h;
      i({
        isMoving: !0,
        movePositions: v || [],
        assistPositions: m || []
      });
    },
    updateDragLine: (h) => {
      const { movePositions: v, assistPositions: m } = h;
      i((S) => ({
        ...S,
        movePositions: v || S.movePositions,
        assistPositions: m || S.assistPositions
      }));
    },
    disposeDragLine: () => {
      i({ isMoving: !1, movePositions: [], assistPositions: [] });
    },
    dragLineData: s,
    defaultGetAssistPosition: (h) => {
      const { editorData: v, assistActionIds: m, action: S, row: b, scale: C, scaleWidth: R, startLeft: z, cursorLeft: E, hideCursor: k } = h, L = [];
      m ? v.forEach((P) => {
        P.actions.forEach((W) => {
          m.includes(W.id) && L.push(W);
        });
      }) : v.forEach((P) => {
        P.id !== b.id ? L.push(...P.actions) : P.actions.forEach((W) => {
          W.id !== S.id && L.push(W);
        });
      });
      const q = Zl(L, {
        startLeft: z,
        scale: C,
        scaleWidth: R
      });
      return k || q.push(E), q;
    },
    defaultGetMovePosition: (h) => {
      const { start: v, end: m, dir: S, scale: b, scaleWidth: C, startLeft: R } = h, { left: z, width: E } = or({ start: v, end: m }, { startLeft: R, scaleWidth: C, scale: b });
      return S ? S === "right" ? [z + E] : [z] : [z, z + E];
    }
  };
}
const uc = (s, i) => s.reduce((r, e) => r + (e?.rowHeight || i), 0), dc = (s, i) => s.map((r) => r?.rowHeight || i), Ui = (s, i, r) => s >= 0 && s <= r && s !== i, fc = ({ top: s, visible: i }) => !i || s < 0 ? null : /* @__PURE__ */ Ee(
  "div",
  {
    className: je("edit-area-insertion-line"),
    style: {
      position: "absolute",
      left: 0,
      right: 0,
      height: "2px",
      background: "#4a90e2",
      zIndex: 1e3,
      pointerEvents: "none",
      top: s
    }
  }
), hc = ({ top: s, height: i, visible: r }) => r ? /* @__PURE__ */ Ee(
  "div",
  {
    className: je("edit-area-drag-preview"),
    style: {
      position: "absolute",
      left: 0,
      right: 0,
      top: s,
      height: i,
      background: "rgba(74, 144, 226, 0.3)",
      border: "2px dashed #4a90e2",
      borderRadius: "4px",
      zIndex: 1001,
      pointerEvents: "none",
      opacity: 0.8
    },
    children: /* @__PURE__ */ Ee(
      "div",
      {
        style: {
          padding: "8px 16px",
          color: "#4a90e2",
          fontSize: "12px",
          fontWeight: "bold"
        },
        children: "拖拽中..."
      }
    )
  }
) : null, pc = {
  isDragging: !1,
  draggedRow: null,
  draggedIndex: -1,
  targetIndex: -1,
  placeholderIndex: -1,
  originalData: [],
  insertionLine: {
    visible: !1,
    position: "top",
    index: -1
  },
  dragPreview: {
    visible: !1,
    top: 0,
    left: 0,
    width: 0,
    height: 0
  }
}, vc = Jt.forwardRef((s, i) => {
  const {
    editorData: r,
    rowHeight: e,
    scaleWidth: a,
    scaleCount: c,
    startLeft: u,
    scrollLeft: h,
    scrollTop: v,
    scale: m,
    hideCursor: S = !1,
    cursorTime: b,
    onScroll: C,
    dragLine: R,
    getAssistDragLineActionIds: z,
    onActionMoveEnd: E,
    onActionMoveStart: k,
    onActionMoving: L,
    onActionResizeEnd: q,
    onActionResizeStart: P,
    onActionResizing: W,
    enableRowDrag: I = !1,
    onRowDragStart: V,
    onRowDragEnd: x,
    setEditorData: j
  } = s, { dragLineData: ie, initDragLine: te, updateDragLine: Q, disposeDragLine: ce, defaultGetAssistPosition: de, defaultGetMovePosition: he } = cc(), pe = Ae(null), Se = Ae(null), Te = Ae(-1), Fe = Ae({ scrollLeft: h, scrollTop: v }), Re = Ae({ clientHeight: 0, clientWidth: 0, scrollHeight: 0, scrollLeft: 0, scrollTop: 0, scrollWidth: 0 }), [G, F] = wt(pc);
  ar(i, () => ({
    get domRef() {
      return pe;
    }
  }));
  const oe = pt((J, re, ue) => {
    const me = [...J];
    ue > re && ue < J.length && (ue = ue - 1);
    const [ve] = me.splice(re, 1);
    return me.splice(ue, 0, ve), me;
  }, []), U = pt(
    (J) => {
      if (!pe.current) return { index: -1, position: "top" };
      const re = pe.current.getBoundingClientRect(), ue = J - re.top + Fe.current.scrollTop, me = r.length;
      let ve = 0;
      if (me > 0 && ue < 0)
        return { index: 0, position: "top" };
      for (let Ne = 0; Ne < me; Ne++) {
        const gt = r[Ne]?.rowHeight || e, we = ve + gt;
        if (ue >= ve && ue <= we) {
          const Ie = Math.abs(ue - ve), De = Math.abs(ue - we);
          return Ie < De ? { index: Ne, position: "top" } : { index: Ne + 1, position: "top" };
        }
        ve = we;
      }
      return { index: me, position: "top" };
    },
    [r, e]
  ), X = pt(
    (J, re) => {
      if (!pe.current) return 0;
      const ue = pe.current.getBoundingClientRect();
      let me = J - ue.top;
      me -= re / 2;
      const ve = ue.height;
      return me = Math.max(0, Math.min(me, ve - re)), me;
    },
    [v]
  ), Y = pt(
    (J) => {
      let re = 0;
      for (let ue = 0; ue < J; ue++)
        re += r[ue]?.rowHeight || e;
      return Math.max(0, re - v);
    },
    [r, v, e]
  ), Z = pt(
    (J, re) => {
      const ue = [...r], me = J.rowHeight || e, ve = Y(re);
      return {
        isDragging: !0,
        draggedRow: J,
        draggedIndex: re,
        targetIndex: -1,
        placeholderIndex: re,
        originalData: ue,
        insertionLine: {
          visible: !1,
          position: "top",
          index: -1
        },
        dragPreview: {
          visible: !0,
          top: ve,
          left: 0,
          width: 0,
          height: me
        }
      };
    },
    [r, e, Y]
  ), ne = pt((J, re, ue, me) => J.targetIndex === re && J.dragPreview.top === ue ? J : {
    ...J,
    targetIndex: re,
    placeholderIndex: re > me ? re - 1 : re,
    insertionLine: {
      visible: re !== -1 && re !== me,
      position: "top",
      index: re
    },
    dragPreview: {
      ...J.dragPreview,
      top: ue
    }
  }, []), fe = pt(
    (J, re, ue, me) => {
      if (Ui(re, J, r.length)) {
        const ve = oe(r, J, re);
        j(ve), x?.({ row: ue, editorData: ve });
      } else
        j(me);
    },
    [r, oe, j, x, Ui]
  ), A = pt(
    (J, re) => {
      if (!I) return;
      const ue = Z(J, re);
      F(ue), V?.({ row: J });
      let me = null, ve = null, Ne = 0;
      const gt = 16;
      let we = 0, Ie = !1;
      const De = (Le) => {
        const Ue = Date.now();
        if (Ue - Ne >= gt) {
          const ut = U(Le).index, ot = X(Le, ue.dragPreview.height);
          F((st) => ne(st, ut, ot, re)), Ne = Ue;
        }
      }, He = () => {
        if (!Ie)
          return ve = requestAnimationFrame(He);
        if (pe.current && Se.current) {
          const Ue = pe.current.querySelector(".ReactVirtualized__Grid");
          if (Ue) {
            const it = Ue.getBoundingClientRect(), ut = 50, ot = 10, st = we - it.top;
            if (st < ut) {
              const xt = Ue.scrollTop - ot;
              C({ ...Re.current, scrollTop: Math.max(0, xt) }), De(we);
            } else if (st > it.height - ut) {
              const xt = Ue.scrollTop + ot;
              C({ ...Re.current, scrollTop: Math.min(xt, Ue.scrollHeight - it.height) }), De(we);
            }
          }
        }
        ve = requestAnimationFrame(He);
      };
      ve = requestAnimationFrame(He);
      const $e = (Le) => {
        Ie = !0, we = Le.clientY, me && cancelAnimationFrame(me), me = requestAnimationFrame(() => {
          De(we), me = null;
        });
      }, Ke = () => {
        Ie = !1, me && (cancelAnimationFrame(me), me = null), ve && (cancelAnimationFrame(ve), ve = null), F((Le) => {
          const { draggedIndex: Ue, targetIndex: it, originalData: ut, draggedRow: ot } = Le, st = {
            ...ue,
            isDragging: !1,
            draggedIndex: -1,
            dragPreview: {
              ...ue.dragPreview,
              visible: !1
            },
            insertionLine: {
              ...ue.insertionLine,
              visible: !1
            }
          };
          return setTimeout(() => {
            fe(Ue, it, ot, ut);
          }, 0), st;
        }), document.removeEventListener("mousemove", $e), document.removeEventListener("mouseup", Ke);
      };
      document.addEventListener("mousemove", $e), document.addEventListener("mouseup", Ke);
    },
    [I, V, Z, U, X, ne, fe, v]
  ), se = (J) => {
    if (R) {
      const re = z && z({
        action: J.action,
        row: J.row,
        editorData: r
      }), ue = ct(b, { scaleWidth: a, scale: m, startLeft: u }), me = de({
        editorData: r,
        assistActionIds: re,
        action: J.action,
        row: J.row,
        scale: m,
        scaleWidth: a,
        startLeft: u,
        hideCursor: S,
        cursorLeft: ue
      });
      te({ assistPositions: me });
    }
  }, Ce = (J) => {
    if (R) {
      const re = he({
        ...J,
        startLeft: u,
        scaleWidth: a,
        scale: m
      });
      Q({ movePositions: re });
    }
  }, H = ({ rowIndex: J, key: re, style: ue }) => {
    const me = r[J];
    return /* @__PURE__ */ Ks(
      lc,
      {
        ...s,
        style: {
          ...ue,
          backgroundPositionX: `0, ${u}px`,
          backgroundSize: `${u}px, ${a}px`
        },
        areaRef: pe,
        key: re,
        rowHeight: me?.rowHeight || e,
        rowData: me,
        dragLineData: ie,
        rowIndex: J,
        dragState: {
          isDragging: G.draggedIndex !== -1,
          draggedIndex: G.draggedIndex
        },
        onRowDragStart: (ve) => {
          A(ve.row, J);
        },
        onActionMoveStart: (ve) => (se(ve), k && k(ve)),
        onActionResizeStart: (ve) => (se(ve), P && P(ve)),
        onActionMoving: (ve) => (Ce(ve), L && L(ve)),
        onActionResizing: (ve) => (Ce(ve), W && W(ve)),
        onActionResizeEnd: (ve) => (ce(), q && q(ve)),
        onActionMoveEnd: (ve) => (ce(), E && E(ve))
      }
    );
  };
  return lr(() => {
    Se.current?.scrollToPosition({ scrollTop: v, scrollLeft: h }), Fe.current = { scrollTop: v, scrollLeft: h };
  }, [v, h]), Qe(() => {
    Se.current?.recomputeGridSize();
  }, [r]), /* @__PURE__ */ Et("div", { ref: pe, className: je("edit-area"), children: [
    /* @__PURE__ */ Ee(cr, { children: ({ width: J, height: re }) => {
      const ue = uc(r, e), me = dc(r, e);
      return ue < re && (me.push(re - ue), Te.current !== re && Te.current >= 0 && setTimeout(
        () => Se.current?.recomputeGridSize({
          rowIndex: me.length - 1
        })
      )), Te.current = re, /* @__PURE__ */ Et(sr, { children: [
        /* @__PURE__ */ Ee(
          lt,
          {
            columnCount: 1,
            rowCount: me.length,
            ref: Se,
            cellRenderer: H,
            columnWidth: Math.max(c * a + u, J),
            width: J,
            height: re,
            rowHeight: ({ index: ve }) => me[ve] || e,
            overscanRowCount: 10,
            overscanColumnCount: 0,
            onScroll: (ve) => {
              Re.current = ve, C(ve);
            }
          }
        ),
        /* @__PURE__ */ Ee(fc, { top: Y(G.insertionLine.index), visible: G.insertionLine.visible }),
        /* @__PURE__ */ Ee(hc, { top: G.dragPreview.top, height: G.dragPreview.height, visible: G.dragPreview.visible })
      ] });
    } }),
    R && /* @__PURE__ */ Ee(sc, { scrollLeft: h, ...ie })
  ] });
}), gc = ({ setCursor: s, maxScaleCount: i, hideCursor: r, scale: e, scaleWidth: a, scaleCount: c, scaleSplitCount: u, startLeft: h, scrollLeft: v, onClickTimeArea: m, getScaleRender: S }) => {
  const b = Ae(null), C = u > 0, R = ({ columnIndex: k, key: L, style: q }) => {
    const P = C ? k % u === 0 : !0, W = ["time-unit"];
    P && W.push("time-unit-big");
    const I = (C ? k / u : k) * e;
    return /* @__PURE__ */ Ee("div", { style: q, className: je(...W), children: P && /* @__PURE__ */ Ee("div", { className: je("time-unit-scale"), children: S ? S(I) : I }) }, L);
  };
  Qe(() => {
    b.current?.recomputeGridSize();
  }, [a, h]);
  const z = (k) => {
    switch (k.index) {
      case 0:
        return h;
      default:
        return C ? a / u : a;
    }
  }, E = z({ index: 1 });
  return /* @__PURE__ */ Ee("div", { className: je("time-area"), children: /* @__PURE__ */ Ee(cr, { children: ({ width: k, height: L }) => /* @__PURE__ */ Et(sr, { children: [
    /* @__PURE__ */ Ee(
      lt,
      {
        ref: b,
        columnCount: C ? c * u + 1 : c,
        columnWidth: z,
        estimatedColumnSize: E,
        rowCount: 1,
        rowHeight: L,
        width: k,
        height: L,
        overscanRowCount: 0,
        overscanColumnCount: 10,
        cellRenderer: R,
        scrollLeft: v
      }
    ),
    /* @__PURE__ */ Ee(
      "div",
      {
        style: { width: k, height: L },
        onClick: (q) => {
          if (r) return;
          const P = q.currentTarget.getBoundingClientRect(), W = q.clientX - P.x, I = Math.max(W + v, h);
          if (I > i * a + h - v) return;
          const V = Pt(I, { startLeft: h, scale: e, scaleWidth: a });
          (m && m(V, q)) !== !1 && s({ time: V });
        },
        className: je("time-area-interact")
      }
    )
  ] }) }) });
}, Sc = Jt.forwardRef((s, i) => {
  const r = Xl(s), { style: e } = s;
  let {
    effects: a,
    editorData: c,
    scrollTop: u,
    autoScroll: h,
    hideCursor: v,
    disableDrag: m,
    scale: S,
    scaleWidth: b,
    startLeft: C,
    minScaleCount: R,
    maxScaleCount: z,
    onChange: E,
    engine: k,
    autoReRender: L = !0,
    onScroll: q
  } = r;
  const P = Ae(k || new ta()), W = Ae(null), I = Ae(null), V = Ae(null), [x, j] = wt(c), [ie, te] = wt(ir), [Q, ce] = wt(ql), [de, he] = wt(!1), [pe, Se] = wt(Number.MAX_SAFE_INTEGER);
  lr(() => {
    Te(Yl(c, { scale: S })), j(c);
  }, [c, R, z, S]), Qe(() => {
    P.current.effects = a;
  }, [a]), Qe(() => {
    P.current.data = x;
  }, [x]), Qe(() => {
    L && P.current.reRender();
  }, [x]), Qe(() => {
    V.current && V.current.setState({ scrollTop: u });
  }, [u]);
  const Te = (F) => {
    const oe = Math.min(z, Math.max(R, F));
    te(oe);
  }, Fe = (F) => {
    E?.(F) !== !1 && (P.current.data = F, L && P.current.reRender());
  }, Re = (F) => {
    let { left: oe, time: U = 0, updateTime: X = !0 } = F;
    if (typeof oe > "u" && typeof U > "u") return !1;
    typeof U > "u" && (typeof oe > "u" && (oe = ct(U, { startLeft: C, scale: S, scaleWidth: b })), U = Pt(oe, { startLeft: C, scale: S, scaleWidth: b }));
    let Y = !0;
    return X && (Y = P.current.setTime(U), L && P.current.reRender()), Y && ce(U), Y;
  }, G = (F) => {
    (V.current?.state?.scrollLeft ?? 0) + F > ie * (b - 1) + C - pe || V.current && V.current.setState({ scrollLeft: Math.max(V.current.state.scrollLeft + F, 0) });
  };
  return Qe(() => {
    const F = ({ time: X }) => {
      Re({ time: X, updateTime: !1 });
    }, oe = () => he(!0), U = () => he(!1);
    P.current.on("setTimeByTick", F), P.current.on("play", oe), P.current.on("paused", U);
  }, []), ar(i, () => ({
    get target() {
      return W.current;
    },
    get listener() {
      return P.current;
    },
    get isPlaying() {
      return P.current.isPlaying;
    },
    get isPaused() {
      return P.current.isPaused;
    },
    setPlayRate: P.current.setPlayRate.bind(P.current),
    getPlayRate: P.current.getPlayRate.bind(P.current),
    setTime: (F) => Re({ time: F }),
    getTime: P.current.getTime.bind(P.current),
    reRender: P.current.reRender.bind(P.current),
    play: (F) => P.current.play({ ...F }),
    pause: P.current.pause.bind(P.current),
    setScrollLeft: (F) => {
      V.current && V.current.setState({ scrollLeft: Math.max(F, 0) });
    },
    setScrollTop: (F) => {
      V.current && V.current.setState({ scrollTop: Math.max(F, 0) });
    }
  })), Qe(() => {
    if (I.current) {
      const F = new ResizeObserver(() => {
        I.current && Se(I.current.getBoundingClientRect().width);
      });
      return F.observe(I.current), () => {
        F && F.disconnect();
      };
    }
  }, []), /* @__PURE__ */ Ee("div", { ref: W, style: e, className: `${tr} ${m ? tr + "-disable" : ""}`, children: /* @__PURE__ */ Ee(To, { ref: V, children: ({ scrollLeft: F, scrollTop: oe, onScroll: U }) => /* @__PURE__ */ Et(sr, { children: [
    /* @__PURE__ */ Ee(
      gc,
      {
        ...r,
        timelineWidth: pe,
        disableDrag: m || de,
        setCursor: Re,
        cursorTime: Q,
        editorData: x,
        scaleCount: ie,
        setScaleCount: Te,
        onScroll: U,
        scrollLeft: F
      }
    ),
    /* @__PURE__ */ Ee(
      vc,
      {
        ...r,
        timelineWidth: pe,
        ref: (X) => I.current = X?.domRef.current,
        disableDrag: m || de,
        editorData: x,
        cursorTime: Q,
        scaleCount: ie,
        setScaleCount: Te,
        scrollTop: oe,
        scrollLeft: F,
        setEditorData: Fe,
        deltaScrollLeft: h ? G : () => {
        },
        onScroll: (X) => {
          U(X), q && q(X);
        }
      }
    ),
    !v && /* @__PURE__ */ Ee(
      oc,
      {
        ...r,
        timelineWidth: pe,
        disableDrag: de,
        scrollLeft: F,
        scaleCount: ie,
        setScaleCount: Te,
        setCursor: Re,
        cursorTime: Q,
        editorData: x,
        areaRef: I,
        scrollSync: V,
        deltaScrollLeft: h ? G : void 0
      }
    )
  ] }) }) });
});
export {
  Sc as Timeline
};
