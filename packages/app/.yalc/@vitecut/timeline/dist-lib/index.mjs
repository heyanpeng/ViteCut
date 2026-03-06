import Ke, { forwardRef as un, useCallback as O, useRef as Rt, useState as ce, useMemo as qt, useEffect as Ct, useImperativeHandle as fn } from "react";
var Ue = { exports: {} }, ge = {};
/**
 * @license React
 * react-jsx-runtime.production.min.js
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var Ze;
function dn() {
  if (Ze) return ge;
  Ze = 1;
  var s = Ke, h = Symbol.for("react.element"), v = Symbol.for("react.fragment"), R = Object.prototype.hasOwnProperty, M = s.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentOwner, X = { key: !0, ref: !0, __self: !0, __source: !0 };
  function D(y, L, k) {
    var T, q = {}, W = null, z = null;
    k !== void 0 && (W = "" + k), L.key !== void 0 && (W = "" + L.key), L.ref !== void 0 && (z = L.ref);
    for (T in L) R.call(L, T) && !X.hasOwnProperty(T) && (q[T] = L[T]);
    if (y && y.defaultProps) for (T in L = y.defaultProps, L) q[T] === void 0 && (q[T] = L[T]);
    return { $$typeof: h, type: y, key: W, ref: z, props: q, _owner: M.current };
  }
  return ge.Fragment = v, ge.jsx = D, ge.jsxs = D, ge;
}
var Ie = {};
/**
 * @license React
 * react-jsx-runtime.development.js
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var De;
function pn() {
  return De || (De = 1, process.env.NODE_ENV !== "production" && function() {
    var s = Ke, h = Symbol.for("react.element"), v = Symbol.for("react.portal"), R = Symbol.for("react.fragment"), M = Symbol.for("react.strict_mode"), X = Symbol.for("react.profiler"), D = Symbol.for("react.provider"), y = Symbol.for("react.context"), L = Symbol.for("react.forward_ref"), k = Symbol.for("react.suspense"), T = Symbol.for("react.suspense_list"), q = Symbol.for("react.memo"), W = Symbol.for("react.lazy"), z = Symbol.for("react.offscreen"), mt = Symbol.iterator, nt = "@@iterator";
    function H(e) {
      if (e === null || typeof e != "object")
        return null;
      var l = mt && e[mt] || e[nt];
      return typeof l == "function" ? l : null;
    }
    var tt = s.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED;
    function x(e) {
      {
        for (var l = arguments.length, c = new Array(l > 1 ? l - 1 : 0), g = 1; g < l; g++)
          c[g - 1] = arguments[g];
        ht("error", e, c);
      }
    }
    function ht(e, l, c) {
      {
        var g = tt.ReactDebugCurrentFrame, S = g.getStackAddendum();
        S !== "" && (l += "%s", c = c.concat([S]));
        var $ = c.map(function(_) {
          return String(_);
        });
        $.unshift("Warning: " + l), Function.prototype.apply.call(console[e], console, $);
      }
    }
    var gt = !1, ot = !1, st = !1, Z = !1, ft = !1, et;
    et = Symbol.for("react.module.reference");
    function at(e) {
      return !!(typeof e == "string" || typeof e == "function" || e === R || e === X || ft || e === M || e === k || e === T || Z || e === z || gt || ot || st || typeof e == "object" && e !== null && (e.$$typeof === W || e.$$typeof === q || e.$$typeof === D || e.$$typeof === y || e.$$typeof === L || // This needs to include all possible module reference object
      // types supported by any Flight configuration anywhere since
      // we don't know which Flight build this will end up being used
      // with.
      e.$$typeof === et || e.getModuleId !== void 0));
    }
    function _t(e, l, c) {
      var g = e.displayName;
      if (g)
        return g;
      var S = l.displayName || l.name || "";
      return S !== "" ? c + "(" + S + ")" : c;
    }
    function Et(e) {
      return e.displayName || "Context";
    }
    function vt(e) {
      if (e == null)
        return null;
      if (typeof e.tag == "number" && x("Received an unexpected object in getComponentNameFromType(). This is likely a bug in React. Please file an issue."), typeof e == "function")
        return e.displayName || e.name || null;
      if (typeof e == "string")
        return e;
      switch (e) {
        case R:
          return "Fragment";
        case v:
          return "Portal";
        case X:
          return "Profiler";
        case M:
          return "StrictMode";
        case k:
          return "Suspense";
        case T:
          return "SuspenseList";
      }
      if (typeof e == "object")
        switch (e.$$typeof) {
          case y:
            var l = e;
            return Et(l) + ".Consumer";
          case D:
            var c = e;
            return Et(c._context) + ".Provider";
          case L:
            return _t(e, e.render, "ForwardRef");
          case q:
            var g = e.displayName || null;
            return g !== null ? g : vt(e.type) || "Memo";
          case W: {
            var S = e, $ = S._payload, _ = S._init;
            try {
              return vt(_($));
            } catch {
              return null;
            }
          }
        }
      return null;
    }
    var Y = Object.assign, Mt = 0, Jt, Yt, Xt, kt, Wt, Bt, Qt;
    function Zt() {
    }
    Zt.__reactDisabledLog = !0;
    function ue() {
      {
        if (Mt === 0) {
          Jt = console.log, Yt = console.info, Xt = console.warn, kt = console.error, Wt = console.group, Bt = console.groupCollapsed, Qt = console.groupEnd;
          var e = {
            configurable: !0,
            enumerable: !0,
            value: Zt,
            writable: !0
          };
          Object.defineProperties(console, {
            info: e,
            log: e,
            warn: e,
            error: e,
            group: e,
            groupCollapsed: e,
            groupEnd: e
          });
        }
        Mt++;
      }
    }
    function fe() {
      {
        if (Mt--, Mt === 0) {
          var e = {
            configurable: !0,
            enumerable: !0,
            writable: !0
          };
          Object.defineProperties(console, {
            log: Y({}, e, {
              value: Jt
            }),
            info: Y({}, e, {
              value: Yt
            }),
            warn: Y({}, e, {
              value: Xt
            }),
            error: Y({}, e, {
              value: kt
            }),
            group: Y({}, e, {
              value: Wt
            }),
            groupCollapsed: Y({}, e, {
              value: Bt
            }),
            groupEnd: Y({}, e, {
              value: Qt
            })
          });
        }
        Mt < 0 && x("disabledDepth fell below zero. This is a bug in React. Please file an issue.");
      }
    }
    var Vt = tt.ReactCurrentDispatcher, de;
    function Dt(e, l, c) {
      {
        if (de === void 0)
          try {
            throw Error();
          } catch (S) {
            var g = S.stack.trim().match(/\n( *(at )?)/);
            de = g && g[1] || "";
          }
        return `
` + de + e;
      }
    }
    var jt = !1, Nt;
    {
      var pe = typeof WeakMap == "function" ? WeakMap : Map;
      Nt = new pe();
    }
    function rt(e, l) {
      if (!e || jt)
        return "";
      {
        var c = Nt.get(e);
        if (c !== void 0)
          return c;
      }
      var g;
      jt = !0;
      var S = Error.prepareStackTrace;
      Error.prepareStackTrace = void 0;
      var $;
      $ = Vt.current, Vt.current = null, ue();
      try {
        if (l) {
          var _ = function() {
            throw Error();
          };
          if (Object.defineProperty(_.prototype, "props", {
            set: function() {
              throw Error();
            }
          }), typeof Reflect == "object" && Reflect.construct) {
            try {
              Reflect.construct(_, []);
            } catch (A) {
              g = A;
            }
            Reflect.construct(e, [], _);
          } else {
            try {
              _.call();
            } catch (A) {
              g = A;
            }
            e.call(_.prototype);
          }
        } else {
          try {
            throw Error();
          } catch (A) {
            g = A;
          }
          e();
        }
      } catch (A) {
        if (A && g && typeof A.stack == "string") {
          for (var w = A.stack.split(`
`), it = g.stack.split(`
`), K = w.length - 1, G = it.length - 1; K >= 1 && G >= 0 && w[K] !== it[G]; )
            G--;
          for (; K >= 1 && G >= 0; K--, G--)
            if (w[K] !== it[G]) {
              if (K !== 1 || G !== 1)
                do
                  if (K--, G--, G < 0 || w[K] !== it[G]) {
                    var ut = `
` + w[K].replace(" at new ", " at ");
                    return e.displayName && ut.includes("<anonymous>") && (ut = ut.replace("<anonymous>", e.displayName)), typeof e == "function" && Nt.set(e, ut), ut;
                  }
                while (K >= 1 && G >= 0);
              break;
            }
        }
      } finally {
        jt = !1, Vt.current = $, fe(), Error.prepareStackTrace = S;
      }
      var $t = e ? e.displayName || e.name : "", Pt = $t ? Dt($t) : "";
      return typeof e == "function" && Nt.set(e, Pt), Pt;
    }
    function me(e, l, c) {
      return rt(e, !1);
    }
    function zt(e) {
      var l = e.prototype;
      return !!(l && l.isReactComponent);
    }
    function lt(e, l, c) {
      if (e == null)
        return "";
      if (typeof e == "function")
        return rt(e, zt(e));
      if (typeof e == "string")
        return Dt(e);
      switch (e) {
        case k:
          return Dt("Suspense");
        case T:
          return Dt("SuspenseList");
      }
      if (typeof e == "object")
        switch (e.$$typeof) {
          case L:
            return me(e.render);
          case q:
            return lt(e.type, l, c);
          case W: {
            var g = e, S = g._payload, $ = g._init;
            try {
              return lt($(S), l, c);
            } catch {
            }
          }
        }
      return "";
    }
    var Ot = Object.prototype.hasOwnProperty, he = {}, Ut = tt.ReactDebugCurrentFrame;
    function Ht(e) {
      if (e) {
        var l = e._owner, c = lt(e.type, e._source, l ? l.type : null);
        Ut.setExtraStackFrame(c);
      } else
        Ut.setExtraStackFrame(null);
    }
    function Ce(e, l, c, g, S) {
      {
        var $ = Function.call.bind(Ot);
        for (var _ in e)
          if ($(e, _)) {
            var w = void 0;
            try {
              if (typeof e[_] != "function") {
                var it = Error((g || "React class") + ": " + c + " type `" + _ + "` is invalid; it must be a function, usually from the `prop-types` package, but received `" + typeof e[_] + "`.This often happens because of typos such as `PropTypes.function` instead of `PropTypes.func`.");
                throw it.name = "Invariant Violation", it;
              }
              w = e[_](l, _, g, c, null, "SECRET_DO_NOT_PASS_THIS_OR_YOU_WILL_BE_FIRED");
            } catch (K) {
              w = K;
            }
            w && !(w instanceof Error) && (Ht(S), x("%s: type specification of %s `%s` is invalid; the type checker function must return `null` or an `Error` but returned a %s. You may have forgotten to pass an argument to the type checker creator (arrayOf, instanceOf, objectOf, oneOf, oneOfType, and shape all require an argument).", g || "React class", c, _, typeof w), Ht(null)), w instanceof Error && !(w.message in he) && (he[w.message] = !0, Ht(S), x("Failed %s type: %s", c, w.message), Ht(null));
          }
      }
    }
    var B = Array.isArray;
    function ve(e) {
      return B(e);
    }
    function f(e) {
      {
        var l = typeof Symbol == "function" && Symbol.toStringTag, c = l && e[Symbol.toStringTag] || e.constructor.name || "Object";
        return c;
      }
    }
    function te(e) {
      try {
        return J(e), !1;
      } catch {
        return !0;
      }
    }
    function J(e) {
      return "" + e;
    }
    function ee(e) {
      if (te(e))
        return x("The provided key is an unsupported type %s. This value must be coerced to a string before before using it here.", f(e)), J(e);
    }
    var m = tt.ReactCurrentOwner, ne = {
      key: !0,
      ref: !0,
      __self: !0,
      __source: !0
    }, ct, be;
    function It(e) {
      if (Ot.call(e, "ref")) {
        var l = Object.getOwnPropertyDescriptor(e, "ref").get;
        if (l && l.isReactWarning)
          return !1;
      }
      return e.ref !== void 0;
    }
    function E(e) {
      if (Ot.call(e, "key")) {
        var l = Object.getOwnPropertyDescriptor(e, "key").get;
        if (l && l.isReactWarning)
          return !1;
      }
      return e.key !== void 0;
    }
    function re(e, l) {
      typeof e.ref == "string" && m.current;
    }
    function Fe(e, l) {
      {
        var c = function() {
          ct || (ct = !0, x("%s: `key` is not a prop. Trying to access it will result in `undefined` being returned. If you need to access the same value within the child component, you should pass it as a different prop. (https://reactjs.org/link/special-props)", l));
        };
        c.isReactWarning = !0, Object.defineProperty(e, "key", {
          get: c,
          configurable: !0
        });
      }
    }
    function U(e, l) {
      {
        var c = function() {
          be || (be = !0, x("%s: `ref` is not a prop. Trying to access it will result in `undefined` being returned. If you need to access the same value within the child component, you should pass it as a different prop. (https://reactjs.org/link/special-props)", l));
        };
        c.isReactWarning = !0, Object.defineProperty(e, "ref", {
          get: c,
          configurable: !0
        });
      }
    }
    var Kt = function(e, l, c, g, S, $, _) {
      var w = {
        // This tag allows us to uniquely identify this as a React Element
        $$typeof: h,
        // Built-in properties that belong on the element
        type: e,
        key: l,
        ref: c,
        props: _,
        // Record the component responsible for creating this element.
        _owner: $
      };
      return w._store = {}, Object.defineProperty(w._store, "validated", {
        configurable: !1,
        enumerable: !1,
        writable: !0,
        value: !1
      }), Object.defineProperty(w, "_self", {
        configurable: !1,
        enumerable: !1,
        writable: !1,
        value: g
      }), Object.defineProperty(w, "_source", {
        configurable: !1,
        enumerable: !1,
        writable: !1,
        value: S
      }), Object.freeze && (Object.freeze(w.props), Object.freeze(w)), w;
    };
    function we(e, l, c, g, S) {
      {
        var $, _ = {}, w = null, it = null;
        c !== void 0 && (ee(c), w = "" + c), E(l) && (ee(l.key), w = "" + l.key), It(l) && (it = l.ref, re(l, S));
        for ($ in l)
          Ot.call(l, $) && !ne.hasOwnProperty($) && (_[$] = l[$]);
        if (e && e.defaultProps) {
          var K = e.defaultProps;
          for ($ in K)
            _[$] === void 0 && (_[$] = K[$]);
        }
        if (w || it) {
          var G = typeof e == "function" ? e.displayName || e.name || "Unknown" : e;
          w && Fe(_, G), it && U(_, G);
        }
        return Kt(e, w, it, S, g, m.current, _);
      }
    }
    var dt = tt.ReactCurrentOwner, ye = tt.ReactDebugCurrentFrame;
    function St(e) {
      if (e) {
        var l = e._owner, c = lt(e.type, e._source, l ? l.type : null);
        ye.setExtraStackFrame(c);
      } else
        ye.setExtraStackFrame(null);
    }
    var ie;
    ie = !1;
    function At(e) {
      return typeof e == "object" && e !== null && e.$$typeof === h;
    }
    function Gt() {
      {
        if (dt.current) {
          var e = vt(dt.current.type);
          if (e)
            return `

Check the render method of \`` + e + "`.";
        }
        return "";
      }
    }
    function oe(e) {
      return "";
    }
    var Tt = {};
    function bt(e) {
      {
        var l = Gt();
        if (!l) {
          var c = typeof e == "string" ? e : e.displayName || e.name;
          c && (l = `

Check the top-level render call using <` + c + ">.");
        }
        return l;
      }
    }
    function Re(e, l) {
      {
        if (!e._store || e._store.validated || e.key != null)
          return;
        e._store.validated = !0;
        var c = bt(l);
        if (Tt[c])
          return;
        Tt[c] = !0;
        var g = "";
        e && e._owner && e._owner !== dt.current && (g = " It was passed a child from " + vt(e._owner.type) + "."), St(e), x('Each child in a list should have a unique "key" prop.%s%s See https://reactjs.org/link/warning-keys for more information.', c, g), St(null);
      }
    }
    function se(e, l) {
      {
        if (typeof e != "object")
          return;
        if (ve(e))
          for (var c = 0; c < e.length; c++) {
            var g = e[c];
            At(g) && Re(g, l);
          }
        else if (At(e))
          e._store && (e._store.validated = !0);
        else if (e) {
          var S = H(e);
          if (typeof S == "function" && S !== e.entries)
            for (var $ = S.call(e), _; !(_ = $.next()).done; )
              At(_.value) && Re(_.value, l);
        }
      }
    }
    function Ye(e) {
      {
        var l = e.type;
        if (l == null || typeof l == "string")
          return;
        var c;
        if (typeof l == "function")
          c = l.propTypes;
        else if (typeof l == "object" && (l.$$typeof === L || // Note: Memo only checks outer props here.
        // Inner props are checked in the reconciler.
        l.$$typeof === q))
          c = l.propTypes;
        else
          return;
        if (c) {
          var g = vt(l);
          Ce(c, e.props, "prop", g, e);
        } else if (l.PropTypes !== void 0 && !ie) {
          ie = !0;
          var S = vt(l);
          x("Component %s declared `PropTypes` instead of `propTypes`. Did you misspell the property assignment?", S || "Unknown");
        }
        typeof l.getDefaultProps == "function" && !l.getDefaultProps.isReactClassApproved && x("getDefaultProps is only used on classic React.createClass definitions. Use a static property named `defaultProps` instead.");
      }
    }
    function xe(e) {
      {
        for (var l = Object.keys(e.props), c = 0; c < l.length; c++) {
          var g = l[c];
          if (g !== "children" && g !== "key") {
            St(e), x("Invalid prop `%s` supplied to `React.Fragment`. React.Fragment can only have `key` and `children` props.", g), St(null);
            break;
          }
        }
        e.ref !== null && (St(e), x("Invalid attribute `ref` supplied to `React.Fragment`."), St(null));
      }
    }
    var _e = {};
    function Ee(e, l, c, g, S, $) {
      {
        var _ = at(e);
        if (!_) {
          var w = "";
          (e === void 0 || typeof e == "object" && e !== null && Object.keys(e).length === 0) && (w += " You likely forgot to export your component from the file it's defined in, or you might have mixed up default and named imports.");
          var it = oe();
          it ? w += it : w += Gt();
          var K;
          e === null ? K = "null" : ve(e) ? K = "array" : e !== void 0 && e.$$typeof === h ? (K = "<" + (vt(e.type) || "Unknown") + " />", w = " Did you accidentally export a JSX literal instead of a component?") : K = typeof e, x("React.jsx: type is invalid -- expected a string (for built-in components) or a class/function (for composite components) but got: %s.%s", K, w);
        }
        var G = we(e, l, c, S, $);
        if (G == null)
          return G;
        if (_) {
          var ut = l.children;
          if (ut !== void 0)
            if (g)
              if (ve(ut)) {
                for (var $t = 0; $t < ut.length; $t++)
                  se(ut[$t], e);
                Object.freeze && Object.freeze(ut);
              } else
                x("React.jsx: Static children should always be an array. You are likely explicitly calling React.jsxs or React.jsxDEV. Use the Babel transform instead.");
            else
              se(ut, e);
        }
        if (Ot.call(l, "key")) {
          var Pt = vt(e), A = Object.keys(l).filter(function(Xe) {
            return Xe !== "key";
          }), ae = A.length > 0 ? "{key: someKey, " + A.join(": ..., ") + ": ...}" : "{key: someKey}";
          if (!_e[Pt + ae]) {
            var Pe = A.length > 0 ? "{" + A.join(": ..., ") + ": ...}" : "{}";
            x(`A props object containing a "key" prop is being spread into JSX:
  let props = %s;
  <%s {...props} />
React keys must be passed directly to JSX without using spread:
  let props = %s;
  <%s key={someKey} {...props} />`, ae, Pt, Pe, Pt), _e[Pt + ae] = !0;
          }
        }
        return e === R ? xe(G) : Ye(G), G;
      }
    }
    function le(e, l, c) {
      return Ee(e, l, c, !0);
    }
    function Lt(e, l, c) {
      return Ee(e, l, c, !1);
    }
    var Me = Lt, Se = le;
    Ie.Fragment = R, Ie.jsx = Me, Ie.jsxs = Se;
  }()), Ie;
}
process.env.NODE_ENV === "production" ? Ue.exports = dn() : Ue.exports = pn();
var N = Ue.exports;
const tn = 80, Ve = 8, ze = 240, Te = 30, Ne = 36, Oe = 24, He = 12, mn = 4, hn = 28, Q = (s, h, v = tn) => s * v * h, yt = (s, h, v = tn) => s / (v * h), pt = (s, h, v) => Math.min(v, Math.max(h, s)), $e = (s) => {
  const v = [
    1e3,
    2e3,
    5e3,
    1e4,
    15e3,
    3e4,
    6e4,
    12e4,
    3e5
  ].find((M) => M / 1e3 * s >= 90) ?? 3e5;
  let R = Math.max(1e3, Math.floor(v / 5));
  return v === 1e3 && (s >= 360 ? R = 40 : s >= 180 ? R = 100 : s >= 90 ? R = 200 : s >= 45 && (R = 500)), {
    major: v / 1e3,
    minor: R / 1e3,
    majorMs: v,
    minorMs: R,
    unit: R < 1e3 ? "subsecond" : "second"
  };
}, vn = (s) => {
  const h = Math.max(0, Math.floor(s * 1e3)), v = Math.floor(h / 1e3), R = Math.floor(v / 3600), M = Math.floor(v % 3600 / 60).toString().padStart(2, "0"), X = (v % 60).toString().padStart(2, "0");
  return R > 0 ? `${R.toString().padStart(2, "0")}:${M}:${X}` : `${M}:${X}`;
}, yn = (s) => {
  const h = Math.max(0, Math.floor(s * 1e3)), v = Math.floor(h / 1e3), R = Math.floor(v / 3600), M = Math.floor(v % 3600 / 60).toString().padStart(2, "0"), X = (v % 60).toString().padStart(2, "0"), D = (h % 1e3).toString().padStart(3, "0");
  return R > 0 ? `${R.toString().padStart(2, "0")}:${M}:${X}.${D}` : `${M}:${X}.${D}`;
}, Ft = (s) => Math.max(0, s.end - s.start), en = (s) => {
  const h = s.effectId || s.id;
  let v = 0;
  for (let M = 0; M < h.length; M += 1)
    v = v * 31 + h.charCodeAt(M) | 0;
  return `hsl(${Math.abs(v) % 360} 65% 42%)`;
}, xn = ({
  canvas: s,
  viewportWidth: h,
  viewportHeight: v,
  scrollLeft: R,
  scrollTop: M,
  zoom: X,
  duration: D,
  showMinorTicks: y,
  showHorizontalLines: L,
  trackLayouts: k
}) => {
  const T = s.getContext("2d");
  if (!T) return;
  const q = window.devicePixelRatio || 1, W = Math.max(1, h), z = Math.max(1, v);
  if (s.width = Math.floor(W * q), s.height = Math.floor(z * q), s.style.width = `${W}px`, s.style.height = `${z}px`, T.setTransform(q, 0, 0, q, 0, 0), T.clearRect(0, 0, W, z), T.fillStyle = "#0f1115", T.fillRect(0, 0, W, z), L) {
    T.strokeStyle = "#1c2028", T.lineWidth = 1;
    for (let Z = 0; Z < k.length - 1; Z += 1) {
      const ft = k[Z], et = k[Z + 1], at = (ft.bottom + et.top) / 2 - M + 0.5;
      at < -1 || at > z + 1 || (T.beginPath(), T.moveTo(0, at), T.lineTo(W, at), T.stroke());
    }
  }
  const mt = Q(1, X), nt = $e(mt), H = Math.max(0, Math.floor(yt(R, X) * 1e3)), tt = Math.min(
    Math.floor(D * 1e3),
    Math.ceil(yt(R + W, X) * 1e3)
  ), x = Math.floor(H / nt.minorMs), ht = Math.ceil(tt / nt.minorMs), gt = Math.max(1, Math.floor(nt.majorMs / nt.minorMs)), ot = Q(nt.minor, X), st = ot < 5 ? 4 : ot < 9 ? 2 : 1;
  for (let Z = x; Z <= ht; Z += 1) {
    const et = Z * nt.minorMs / 1e3, at = Q(et, X) - R, _t = Z % gt === 0;
    !y && !_t || !_t && Z % st !== 0 || (T.strokeStyle = _t ? "#36445e" : "#1b2230", T.beginPath(), T.moveTo(at + 0.5, 0), T.lineTo(at + 0.5, z), T.stroke());
  }
}, gn = ({
  canvas: s,
  viewportWidth: h,
  scrollLeft: v,
  scrollTop: R,
  zoom: M,
  duration: X,
  showMinorTicks: D
}) => {
  const y = s.getContext("2d");
  if (!y) return;
  const L = window.devicePixelRatio || 1, k = Math.max(1, h), T = Te;
  s.width = Math.floor(k * L), s.height = Math.floor(T * L), s.style.width = `${k}px`, s.style.height = `${T}px`, y.setTransform(L, 0, 0, L, 0, 0), y.clearRect(0, 0, k, T), y.fillStyle = "#121722", y.fillRect(0, 0, k, T), y.strokeStyle = "#2a3344", y.beginPath(), y.moveTo(0, T - 0.5), y.lineTo(k, T - 0.5), y.stroke();
  const q = Q(1, M), W = $e(q), z = Math.max(0, Math.floor(yt(v, M) * 1e3)), mt = Math.min(
    Math.floor(X * 1e3),
    Math.ceil(yt(v + k, M) * 1e3)
  ), nt = Math.floor(z / W.minorMs), H = Math.ceil(mt / W.minorMs), tt = Math.max(1, Math.floor(W.majorMs / W.minorMs)), x = Q(W.minor, M), ht = x < 5 ? 4 : x < 9 ? 2 : 1, gt = [];
  for (let ot = nt; ot <= H; ot += 1) {
    const st = ot * W.minorMs, Z = st / 1e3, ft = Q(Z, M) - v, et = ot % tt === 0;
    !D && !et || !et && ot % ht !== 0 || (y.strokeStyle = et ? "#7487aa" : "#3e506d", y.beginPath(), y.moveTo(ft + 0.5, et ? 0 : 14), y.lineTo(ft + 0.5, T), y.stroke(), et && gt.push(st));
  }
  y.fillStyle = "#b4c0d4", y.font = "11px ui-sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", y.textBaseline = "top", y.textAlign = "left";
  for (const ot of gt) {
    const st = ot / 1e3, Z = Q(st, M) - v, ft = vn(st), et = y.measureText(ft).width, at = pt(Z + 4, 2, Math.max(2, k - et - 2));
    y.fillText(ft, at, 2);
  }
}, In = ({
  clip: s,
  renderClip: h,
  left: v,
  top: R,
  width: M,
  height: X,
  isSelected: D,
  isDraggedSource: y,
  isDimmed: L,
  content: k,
  onPointerDown: T,
  onPointerMove: q,
  onPointerUp: W,
  onClick: z,
  onDoubleClick: mt,
  onTrimPointerDown: nt,
  onTrimPointerMove: H,
  onTrimPointerUp: tt
}) => {
  const x = `clip-item${D ? " clip-item-selected" : ""}${y ? " clip-item-dragging" : ""}${L ? " clip-item-dimmed" : ""}`;
  return /* @__PURE__ */ N.jsxs(
    "div",
    {
      "data-clip-id": s.id,
      className: x,
      onPointerDown: T,
      onClick: z,
      onDoubleClick: mt,
      onPointerMove: q,
      onPointerUp: W,
      style: {
        left: v,
        top: R,
        width: M,
        height: X,
        background: en(h)
        // 设置片段自身的背景色
      },
      children: [
        /* @__PURE__ */ N.jsx(
          "div",
          {
            className: "clip-item-trim-handle clip-item-trim-left",
            onPointerDown: (ht) => nt(ht, "left"),
            onPointerMove: H,
            onPointerUp: tt
          }
        ),
        /* @__PURE__ */ N.jsx(
          "div",
          {
            className: "clip-item-trim-handle clip-item-trim-right",
            onPointerDown: (ht) => nt(ht, "right"),
            onPointerMove: H,
            onPointerUp: tt
          }
        ),
        k ?? /* @__PURE__ */ N.jsx(N.Fragment, { children: /* @__PURE__ */ N.jsx("div", { className: "clip-item-content", children: /* @__PURE__ */ N.jsx("div", { className: "clip-item-label", children: s.id }) }) })
      ]
    },
    s.id
  );
}, Tn = ({
  clip: s,
  left: h,
  top: v,
  width: R,
  height: M,
  isDropValid: X,
  content: D,
  onPointerMove: y,
  onPointerUp: L
}) => {
  const k = `drag-preview${X ? " drag-preview-valid" : " drag-preview-invalid"}`;
  return /* @__PURE__ */ N.jsx(
    "div",
    {
      className: k,
      onPointerMove: y,
      onPointerUp: L,
      style: {
        left: h,
        top: v,
        width: R,
        height: M,
        background: en(s)
      },
      children: D ?? /* @__PURE__ */ N.jsx("div", { className: "drag-preview-content", children: /* @__PURE__ */ N.jsx("div", { className: "drag-preview-label", children: s.id }) })
    }
  );
}, Le = 0.04, bn = un(
  ({
    editorData: s,
    duration: h,
    playing: v,
    currentTime: R,
    showMinorTicks: M = !0,
    showHorizontalLines: X = !0,
    dragSnapToClipEdges: D = !0,
    dragSnapToTimelineTicks: y = !1,
    trimSnapToClipEdges: L = !0,
    trimSnapToTimelineTicks: k = !0,
    trimSnapThresholdPx: T = Ve,
    trimSnapTickMode: q = "minor",
    initialTime: W = 0,
    minZoom: z = 0.25,
    maxZoom: mt = 8,
    zoom: nt,
    rowHeight: H = 52,
    trackGap: tt = 0,
    trackHeightPresets: x,
    trackControlsWidth: ht = 184,
    renderTrackPanelHeader: gt,
    renderTrackControls: ot,
    getActionRender: st,
    getActionDragRender: Z,
    onActionMoveStart: ft,
    onActionMoving: et,
    onActionMoveEnd: at,
    onActionResizeStart: _t,
    onActionResizing: Et,
    onActionResizeEnd: vt,
    onEditorDataChange: Y,
    onCursorDragStart: Mt,
    onCursorDragEnd: Jt,
    onCursorDrag: Yt,
    onPlayStart: Xt,
    onPlayEnd: kt,
    onZoomChange: Wt,
    onClickTimeArea: Bt,
    onClickRow: Qt,
    onClickAction: Zt,
    onClickActionOnly: ue,
    onDoubleClickRow: fe,
    onDoubleClickAction: Vt
  }, de) => {
    const Dt = O((t) => t.kind === "video" || t.kind === "audio", []), jt = Rt(null), Nt = Rt(null), pe = Rt(null), rt = Rt(null), me = Rt(null), zt = Rt(null), lt = Rt(W), Ot = Rt(v), he = Rt(1), Ut = Rt(!1), [Ht, Ce] = ce(1), [B, ve] = ce({
      width: 0,
      height: 0,
      scrollLeft: 0,
      scrollTop: 0
    }), [f, te] = ce(null), [J, ee] = ce(
      null
    ), [m, ne] = ce(null), [ct, be] = ce(null), It = O((t) => {
      be(t);
    }, []), E = pt(nt ?? Ht, z, mt);
    qt(() => {
      let t = Number.POSITIVE_INFINITY, n = 0;
      return s.forEach((r) => {
        r.actions.forEach((i) => {
          t = Math.min(t, i.start), n = Math.max(n, i.end);
        });
      }), {
        minStart: Number.isFinite(t) ? t : 0,
        maxEnd: n
      };
    }, [s]);
    const re = O(
      (t, n) => t === "main" ? (x == null ? void 0 : x.main) ?? H : t === "audio" ? (x == null ? void 0 : x.audio) ?? H : n === "video" ? (x == null ? void 0 : x.video) ?? H : n === "audio" ? (x == null ? void 0 : x.audio) ?? H : n === "image" ? (x == null ? void 0 : x.image) ?? H : n === "text" ? (x == null ? void 0 : x.text) ?? H : n === "solid" ? (x == null ? void 0 : x.solid) ?? H : (x == null ? void 0 : x.normal) ?? H,
      [H, x]
    ), Fe = Q(h, E), U = qt(() => {
      let t = Te;
      return s.map((n, r) => {
        var b;
        const i = (b = n.actions[0]) == null ? void 0 : b.kind, o = re(n.role, i), a = Math.max(
          hn,
          n.rowHeight ?? o
        ), u = {
          id: n.id,
          index: r,
          top: t,
          height: a,
          bottom: t + a
        };
        return t += a + tt, u;
      });
    }, [s, re, tt]), Kt = qt(
      () => new Map(U.map((t) => [t.id, t])),
      [U]
    ), we = qt(
      () => new Map(s.map((t, n) => [t.id, n])),
      [s]
    ), dt = qt(
      () => s.findIndex((t) => t.role === "main"),
      [s]
    ), ye = U.length > 0 ? U[U.length - 1].bottom : Te, St = B.scrollLeft - ze, ie = B.scrollLeft + B.width + ze, At = qt(
      () => s.map((t) => ({
        ...t,
        actions: t.actions.filter((n) => {
          const r = Q(n.start, E);
          return Q(n.end, E) >= St && r <= ie;
        })
      })),
      [s, St, ie, E]
    ), Gt = O(() => {
      Nt.current && xn({
        canvas: Nt.current,
        viewportWidth: B.width,
        viewportHeight: B.height,
        scrollLeft: B.scrollLeft,
        scrollTop: B.scrollTop,
        zoom: E,
        duration: h,
        showMinorTicks: M,
        showHorizontalLines: X,
        trackLayouts: U
      });
    }, [
      h,
      X,
      M,
      U,
      B.height,
      B.scrollLeft,
      B.scrollTop,
      B.width,
      E
    ]), oe = O(() => {
      pe.current && gn({
        canvas: pe.current,
        viewportWidth: B.width,
        viewportHeight: B.height,
        scrollLeft: B.scrollLeft,
        scrollTop: B.scrollTop,
        zoom: E,
        duration: h,
        showMinorTicks: M
      });
    }, [
      h,
      M,
      B.height,
      B.scrollLeft,
      B.scrollTop,
      B.width,
      E
    ]), Tt = O(
      (t) => {
        var r;
        if (!me.current) return;
        const n = Q(t, E) - (((r = rt.current) == null ? void 0 : r.scrollLeft) ?? 0);
        me.current.style.transform = `translateX(${n}px)`;
      },
      [E]
    ), bt = O(
      (t, n = !0) => {
        const r = pt(t, 0, h);
        return lt.current = r, Tt(r), n && (Yt == null || Yt(r)), r;
      },
      [h, Yt, Tt]
    );
    Ct(() => {
      Tt(lt.current);
    }, [Tt]), Ct(() => {
      R != null && bt(R, !1);
    }, [R, bt]), Ct(() => {
      if (!v || R == null) return;
      const t = rt.current;
      if (!t) return;
      const n = Q(R, E), i = t.scrollLeft + t.clientWidth;
      if (n <= i) return;
      const o = Math.max(0, n);
      Math.abs(o - t.scrollLeft) < 1 || (t.scrollLeft = o);
    }, [R, v, E]), Ct(() => {
      const t = jt.current, n = rt.current;
      if (!t || !n) return;
      const r = () => {
        ve({
          width: n.clientWidth,
          height: n.clientHeight,
          scrollLeft: n.scrollLeft,
          scrollTop: n.scrollTop
        }), Tt(lt.current);
      };
      r();
      const i = new ResizeObserver(r);
      return i.observe(t), n.addEventListener("scroll", r, { passive: !0 }), () => {
        i.disconnect(), n.removeEventListener("scroll", r);
      };
    }, [Tt]), Ct(() => {
      const t = jt.current;
      if (!t) return;
      const n = (i) => {
        (i.ctrlKey || i.metaKey) && i.preventDefault();
      }, r = (i) => {
        i.preventDefault();
      };
      return t.addEventListener("wheel", n, {
        passive: !1
      }), t.addEventListener("gesturestart", r, {
        passive: !1
      }), t.addEventListener("gesturechange", r, {
        passive: !1
      }), t.addEventListener("gestureend", r, {
        passive: !1
      }), () => {
        t.removeEventListener("wheel", n), t.removeEventListener("gesturestart", r), t.removeEventListener("gesturechange", r), t.removeEventListener("gestureend", r);
      };
    }, []), Ct(() => {
      Gt();
    }, [Gt]), Ct(() => {
      oe();
    }, [oe]), Ct(() => {
      const t = Ot.current;
      !t && v && (Xt == null || Xt(lt.current)), t && !v && (kt == null || kt(lt.current)), Ot.current = v;
    }, [kt, Xt, v]), fn(
      de,
      () => ({
        target: jt.current,
        isPlaying: v,
        isPaused: !v,
        setTime: (t) => {
          bt(t);
        },
        getTime: () => lt.current,
        setPlayRate: (t) => {
          !Number.isFinite(t) || t <= 0 || (he.current = t);
        },
        getPlayRate: () => he.current,
        reRender: () => {
          Gt(), oe(), Tt(lt.current);
        },
        play: (t) => !1,
        pause: () => {
        },
        setScrollLeft: (t) => {
          rt.current && (rt.current.scrollLeft = Math.max(0, t));
        },
        setScrollTop: (t) => {
          rt.current && (rt.current.scrollTop = Math.max(0, t));
        }
      }),
      [Gt, oe, v, bt, Tt]
    );
    const Re = O(
      (t, n, r) => {
        const i = yt(Ve, E), o = [lt.current];
        D && s.forEach((b) => {
          b.actions.forEach((p) => {
            p.id !== t && o.push(p.start, p.end);
          });
        });
        let a = null;
        const u = [n, n + r];
        for (const b of o)
          for (const p of u) {
            const I = b - p;
            Math.abs(I) > i || (!a || Math.abs(I) < Math.abs(a.delta)) && (a = { delta: I, time: b });
          }
        if (y) {
          const p = $e(Q(1, E)).minor;
          for (const I of u) {
            const C = pt(
              Math.round(I / p) * p,
              0,
              h
            ), d = C - I;
            Math.abs(d) > i || (!a || Math.abs(d) < Math.abs(a.delta)) && (a = { delta: d, time: C });
          }
        }
        return a ? { start: n + a.delta, snappedTime: a.time } : { start: n, snappedTime: null };
      },
      [
        D,
        y,
        h,
        s,
        E
      ]
    ), se = O(
      (t) => {
        const n = rt.current;
        if (!n || s.length === 0) return null;
        const r = n.getBoundingClientRect(), i = t - r.top + n.scrollTop, o = U[0], a = U[U.length - 1];
        if (!o || !a) return null;
        if (i <= o.top) return o.id;
        if (i >= a.bottom) return a.id;
        const u = U.find(
          (p) => i >= p.top && i < p.bottom
        );
        if (u) return u.id;
        const b = U.reduce((p, I) => {
          const C = i < I.top ? I.top - i : i > I.bottom ? i - I.bottom : 0;
          return !p || C < p.distance ? { id: I.id, distance: C } : p;
        }, null);
        return (b == null ? void 0 : b.id) ?? a.id;
      },
      [s.length, U]
    ), Ye = O(
      (t) => {
        const n = new Set(s.map((a) => a.id));
        let r = s.length + 1, i = `track-${r}`;
        for (; n.has(i); )
          r += 1, i = `track-${r}`;
        const o = t === "audio" ? "audio" : "normal";
        return {
          id: i,
          name: `Track ${r}`,
          role: o,
          rowHeight: re(o, t),
          actions: []
        };
      },
      [s, re]
    ), xe = O(
      (t, n) => (t.kind ?? "video") === "audio" ? dt < 0 ? !0 : n > dt : dt < 0 ? !0 : n <= dt,
      [dt]
    ), _e = O(
      (t, n) => {
        const r = we.get(n);
        if (r == null) return !1;
        const i = s[r];
        if (!i) return !1;
        const o = t.kind ?? "video", a = new Set(
          i.actions.filter((u) => u.id !== t.id).map((u) => u.kind ?? "video")
        );
        return !(a.size > 0 && !a.has(o) || i.role === "main" && o !== "video" || i.role === "audio" && o !== "audio" || o === "audio" && i.role !== "audio" || o !== "audio" && dt >= 0 && r > dt || o === "audio" && dt >= 0 && r <= dt);
      },
      [s, dt, we]
    ), Ee = O(
      (t, n) => {
        const r = rt.current;
        if (!r) return null;
        const i = r.getBoundingClientRect(), o = t - i.top + r.scrollTop, a = Math.max(4, He / 2);
        for (let u = 0; u < U.length - 1; u += 1) {
          const b = (U[u].bottom + U[u + 1].top) / 2;
          if (Math.abs(o - b) <= a) {
            const p = u + 1;
            return xe(n, p) ? { index: p, lineY: b } : null;
          }
        }
        if (U.length > 0) {
          const u = U[U.length - 1], b = u.bottom + Math.max(2, tt / 2);
          if (o > u.bottom + He && xe(n, s.length))
            return { index: s.length, lineY: b };
        }
        return null;
      },
      [xe, s.length, tt, U]
    ), le = O(
      (t, n) => {
        const r = s.find((i) => i.id === t);
        return r ? r.actions.filter((i) => i.id !== n).sort((i, o) => i.start - o.start) : [];
      },
      [s]
    ), Lt = O(() => {
      if (!ct) return null;
      const t = s.findIndex(
        (a) => a.id === ct.rowId
      );
      if (t < 0) return null;
      const n = s[t], r = n.actions.findIndex(
        (a) => a.id === ct.actionId
      );
      if (r < 0) return null;
      const i = n.actions[r], o = lt.current;
      return o <= i.start || o >= i.end ? null : { trackIndex: t, row: n, actionIndex: r, action: i, playheadTime: o };
    }, [s, ct]), Me = O(
      (t, n) => {
        const r = new Set(t.actions.map((a) => a.id));
        let i = 1, o = `${n}-split-${i}`;
        for (; r.has(o); )
          i += 1, o = `${n}-split-${i}`;
        return o;
      },
      []
    ), Se = O(() => {
      const t = Lt();
      if (!t || !Y) return;
      const { trackIndex: n, row: r, actionIndex: i, action: o, playheadTime: a } = t;
      if (a <= o.start || a >= o.end) return;
      const u = a - o.start, b = o.end - a;
      if (u <= Le || b <= Le)
        return;
      const p = Number(o.inPoint ?? 0), I = Number(
        o.outPoint ?? p + Ft(o)
      ), C = {
        ...o,
        id: Me(r, o.id),
        start: a,
        end: o.end,
        inPoint: p + u,
        outPoint: I
      }, d = {
        ...o,
        start: o.start,
        end: a,
        inPoint: p,
        outPoint: p + u
      }, P = s.map((F, V) => {
        if (V !== n) return F;
        const j = [...F.actions];
        return j.splice(i, 1, d, C), { ...F, actions: j };
      });
      Y(P), It({ rowId: r.id, actionId: C.id });
    }, [
      Me,
      s,
      Lt,
      Y,
      It
    ]), e = O(() => {
      const t = Lt();
      if (!t || !Y) return;
      const { trackIndex: n, actionIndex: r, action: i, playheadTime: o } = t;
      if (o <= i.start || o >= i.end) return;
      const a = s.map((u, b) => {
        if (b !== n) return u;
        const p = u.actions.map((I, C) => {
          if (C !== r) return I;
          const d = o - I.start;
          return {
            ...I,
            start: o,
            inPoint: Number(I.inPoint ?? 0) + d
          };
        });
        return { ...u, actions: p };
      });
      Y(a);
    }, [s, Lt, Y]), l = O(() => {
      const t = Lt();
      if (!t || !Y) return;
      const { trackIndex: n, actionIndex: r, action: i, playheadTime: o } = t;
      if (o <= i.start) return;
      const a = s.map((u, b) => {
        if (b !== n) return u;
        const p = u.actions.map((I, C) => {
          if (C !== r) return I;
          const d = o - I.end;
          return {
            ...I,
            end: o,
            outPoint: Number(I.outPoint ?? I.inPoint ?? 0) + Ft(I) + d
          };
        });
        return { ...u, actions: p };
      });
      Y(a);
    }, [s, Lt, Y]);
    O(() => {
      if (!ct || !Y) return;
      const t = s.map((n) => n.id !== ct.rowId ? n : {
        ...n,
        actions: n.actions.filter(
          (r) => r.id !== ct.actionId
        )
      }).filter((n) => !(n.role !== "main" && n.actions.length === 0));
      Y(t), It(null);
    }, [s, Y, ct, It]);
    const c = O(
      (t, n, r) => {
        const i = le(t, n), o = [];
        let a = 0;
        for (const u of i)
          u.start > a && u.start - a >= r && o.push([a, u.start - r]), a = Math.max(a, u.end);
        return h - a >= r && o.push([a, h - r]), o;
      },
      [h, le]
    ), g = O(
      (t, n, r, i) => {
        const o = c(
          t,
          n,
          r
        );
        if (o.length === 0) return null;
        for (const [p, I] of o)
          if (i >= p && i <= I)
            return i;
        const a = yt(Ve, E);
        let u = null, b = Number.POSITIVE_INFINITY;
        for (const [p, I] of o) {
          const C = Math.abs(i - p);
          C <= a && C < b && (b = C, u = p);
          const d = Math.abs(i - I);
          d <= a && d < b && (b = d, u = I);
        }
        return u ?? null;
      },
      [c, E]
    ), S = O(
      (t, n, r, i) => {
        const o = yt(T, E);
        let a = null, u = Number.POSITIVE_INFINITY, b = !1;
        const p = (i == null ? void 0 : i.min) ?? 0, I = (i == null ? void 0 : i.max) ?? h, C = (d) => d >= p && d <= I;
        if (L && s.forEach((d) => {
          d.actions.forEach((P) => {
            if (d.id === t && P.id === n) return;
            const F = [P.start, P.end];
            for (const V of F) {
              if (!C(V)) continue;
              const j = Math.abs(V - r);
              j <= o && j < u && (u = j, a = V, b = !0);
            }
          });
        }), b) {
          const d = a ?? r;
          return { time: d, snappedTime: d };
        }
        if (k) {
          const d = Q(1, E), P = $e(d), F = q === "major" ? P.major : P.minor, V = Math.round(r / F) * F, j = pt(V, 0, h);
          if (!C(j))
            return a == null ? { time: r, snappedTime: null } : { time: a, snappedTime: a };
          const xt = Math.abs(j - r);
          xt <= o && xt < u && (u = xt, a = j);
        }
        return a == null ? { time: r, snappedTime: null } : { time: a, snappedTime: a };
      },
      [
        h,
        s,
        le,
        T,
        q,
        L,
        k,
        E
      ]
    ), $ = (t, n, r) => {
      t.button === 0 && (m || r.movable === !1 || r.disable || (t.preventDefault(), Ut.current = !1, t.currentTarget.setPointerCapture(
        t.pointerId
      ), It({ rowId: n, actionId: r.id }), ee({
        rowId: n,
        action: r,
        pointerId: t.pointerId,
        startClientX: t.clientX,
        startClientY: t.clientY
      })));
    }, _ = (t) => {
      if (!f) {
        if (!J || J.pointerId !== t.pointerId) return;
        const V = t.clientX - J.startClientX, j = t.clientY - J.startClientY;
        if (Math.hypot(V, j) < mn) return;
        Ut.current = !0;
        const xt = s.find((ke) => ke.id === J.rowId);
        xt && (ft == null || ft({
          action: J.action,
          row: xt
        })), te({
          originRowId: J.rowId,
          previewRowId: J.rowId,
          insertRowIndex: null,
          insertLineY: null,
          actionId: J.action.id,
          action: J.action,
          pointerId: J.pointerId,
          startClientX: J.startClientX,
          originStart: J.action.start,
          previewStart: J.action.start,
          commitStart: J.action.start,
          snappedTime: null,
          isDropValid: !0
        }), ee(null);
        return;
      }
      if (f.pointerId !== t.pointerId) return;
      const n = rt.current;
      if (n) {
        const V = n.getBoundingClientRect();
        if (t.clientY < V.top + Ne)
          n.scrollTop = Math.max(
            0,
            n.scrollTop - Oe
          );
        else if (t.clientY > V.bottom - Ne) {
          const j = n.scrollHeight - n.clientHeight;
          n.scrollTop = Math.min(
            j,
            n.scrollTop + Oe
          );
        }
        if (t.clientX < V.left + Ne)
          n.scrollLeft = Math.max(
            0,
            n.scrollLeft - Oe
          );
        else if (t.clientX > V.right - Ne) {
          const j = n.scrollWidth - n.clientWidth;
          n.scrollLeft = Math.min(
            j,
            n.scrollLeft + Oe
          );
        }
      }
      const r = t.clientX - f.startClientX, i = yt(r, E), o = Ft(f.action), a = pt(
        f.originStart + i,
        0,
        h - o
      ), u = Re(f.actionId, a, o), b = pt(u.start, 0, h - o), p = Ee(
        t.clientY,
        f.action
      ), I = se(t.clientY) ?? f.previewRowId, C = _e(f.action, I), d = p ? b : C ? g(
        I,
        f.actionId,
        o,
        b
      ) : null, P = s.find((V) => V.id === f.originRowId), F = d != null && P ? (et == null ? void 0 : et({
        action: f.action,
        row: P,
        start: d,
        end: d + o,
        targetRowId: p ? void 0 : I,
        insertRowIndex: (p == null ? void 0 : p.index) ?? null
      })) !== !1 : d != null;
      te(
        (V) => V && {
          ...V,
          previewRowId: F ? I : V.previewRowId,
          previewStart: F ? b : V.previewStart,
          insertRowIndex: F ? (p == null ? void 0 : p.index) ?? null : null,
          insertLineY: F ? (p == null ? void 0 : p.lineY) ?? null : null,
          commitStart: F ? d : null,
          snappedTime: F && d != null ? u.snappedTime : null,
          isDropValid: F && d != null
        }
      );
    }, w = (t) => {
      if ((J == null ? void 0 : J.pointerId) === t.pointerId) {
        ee(null);
        return;
      }
      if (!f || f.pointerId !== t.pointerId) return;
      if (!f.isDropValid) {
        te(null);
        return;
      }
      const n = Ft(f.action), r = {
        ...f.action,
        start: f.commitStart ?? f.previewStart,
        end: (f.commitStart ?? f.previewStart) + n
      }, i = f.insertRowIndex != null ? Ye(f.action.kind) : null, o = i && f.insertRowIndex != null ? (() => {
        const d = [...s];
        return d.splice(f.insertRowIndex, 0, i), d;
      })() : s, a = (i == null ? void 0 : i.id) ?? f.previewRowId, u = o.map((d) => d.id === f.originRowId && f.originRowId === a ? {
        ...d,
        actions: d.actions.map(
          (P) => P.id === f.actionId ? r : P
        )
      } : d.id === f.originRowId ? {
        ...d,
        actions: d.actions.filter(
          (P) => P.id !== f.actionId
        )
      } : d.id === a ? { ...d, actions: [...d.actions, r] } : d), p = f.originRowId !== a ? u.filter(
        (d) => !(d.id === f.originRowId && d.actions.length === 0)
      ) : u, I = p.find(
        (d) => d.id === a
      ), C = s.find((d) => d.id === f.originRowId);
      C && (at == null || at({
        action: f.action,
        row: C,
        start: r.start,
        end: r.end,
        targetRowId: I == null ? void 0 : I.id,
        insertRowIndex: f.insertRowIndex
      })), Y == null || Y(p), te(null);
    }, it = (t, n, r, i) => {
      if (t.button !== 0) return;
      t.preventDefault(), t.stopPropagation(), t.currentTarget.setPointerCapture(
        t.pointerId
      ), It({ rowId: n, actionId: r.id });
      const o = s.find((a) => a.id === n);
      o && (_t == null || _t({
        action: r,
        row: o,
        dir: i
      })), ne({
        rowId: n,
        actionId: r.id,
        side: i,
        pointerId: t.pointerId,
        startClientX: t.clientX,
        origin: r,
        preview: { ...r },
        snappedTime: null
      });
    }, K = (t) => {
      if (!m || m.pointerId !== t.pointerId) return;
      const n = le(m.rowId, m.actionId), r = yt(t.clientX - m.startClientX, E);
      if (m.side === "left") {
        const j = m.origin.end, xt = n.reduce((wt, Be) => Be.end <= j && Be.end > wt ? Be.end : wt, 0), ke = Dt(m.origin) ? -Number(m.origin.inPoint ?? 0) : Number.NEGATIVE_INFINITY, Ae = Math.max(
          ke,
          -m.origin.start,
          xt - m.origin.start
        ), Ge = Ft(m.origin) - Le, an = pt(r, Ae, Ge), cn = m.origin.start + an, qe = m.origin.start + Ae, Je = m.origin.start + Ge, We = S(
          m.rowId,
          m.actionId,
          cn,
          {
            min: qe,
            max: Je
          }
        ), je = pt(We.time, qe, Je), Qe = s.find((wt) => wt.id === m.rowId);
        if (Qe && (Et == null ? void 0 : Et({
          action: m.origin,
          row: Qe,
          start: je,
          end: j,
          dir: "left"
        })) === !1)
          return;
        ne(
          (wt) => wt && {
            ...wt,
            preview: {
              ...wt.origin,
              start: je,
              inPoint: Number(wt.origin.inPoint ?? 0) + (je - wt.origin.start),
              end: j
            },
            snappedTime: je === We.time ? We.snappedTime : null
          }
        );
        return;
      }
      const i = Le - Ft(m.origin), o = n.reduce((j, xt) => xt.start >= m.origin.end && xt.start < j ? xt.start : j, Number.POSITIVE_INFINITY), a = h - m.origin.end, u = o === Number.POSITIVE_INFINITY ? a : o - m.origin.end, b = Math.min(a, u), p = pt(r, i, b), I = m.origin.end + p, C = m.origin.end + i, d = m.origin.end + b, P = S(m.rowId, m.actionId, I, {
        min: C,
        max: d
      }), F = pt(P.time, C, d), V = s.find((j) => j.id === m.rowId);
      V && (Et == null ? void 0 : Et({
        action: m.origin,
        row: V,
        start: m.origin.start,
        end: F,
        dir: "right"
      })) === !1 || ne(
        (j) => j && {
          ...j,
          preview: {
            ...j.origin,
            end: F,
            outPoint: Number(j.origin.outPoint ?? j.origin.inPoint ?? 0) + (F - j.origin.end)
          },
          snappedTime: F === P.time ? P.snappedTime : null
        }
      );
    }, G = (t) => {
      if (!m || m.pointerId !== t.pointerId) return;
      const n = s.find((o) => o.id === m.rowId), r = n == null ? void 0 : n.actions.find((o) => o.id === m.actionId);
      n && r && (vt == null || vt({
        action: r,
        row: n,
        start: m.preview.start,
        end: m.preview.end,
        dir: m.side
      }));
      const i = s.map((o) => o.id !== m.rowId ? o : {
        ...o,
        actions: o.actions.map(
          (a) => a.id === m.actionId ? m.preview : a
        )
      });
      Y == null || Y(i), ne(null);
    }, ut = O(
      (t) => {
        const n = pt(t, z, mt);
        return nt == null && Ce(n), Wt == null || Wt(n), n;
      },
      [nt, mt, z, Wt]
    ), $t = O(
      (t, n, r) => {
        const i = rt.current;
        if (!i) return;
        const o = i.getBoundingClientRect(), a = ut(n);
        if (a === E) return;
        const u = r ?? o.left + o.width / 2, p = Q(t, a) - (u - o.left);
        requestAnimationFrame(() => {
          i.scrollLeft = Math.max(0, p);
        });
      },
      [ut, E]
    ), Pt = (t) => {
      if (!t.ctrlKey && !t.metaKey) return;
      t.preventDefault();
      const n = rt.current;
      if (!n) return;
      const r = n.getBoundingClientRect(), i = t.clientX - r.left + n.scrollLeft, o = yt(i, E), a = t.deltaY > 0 ? 0.9 : 1.1;
      $t(o, E * a, t.clientX);
    }, A = O(
      (t) => {
        const n = rt.current;
        if (!n) return 0;
        const r = n.getBoundingClientRect(), i = t - r.left + n.scrollLeft;
        return pt(yt(i, E), 0, h);
      },
      [h, E]
    ), ae = O(
      (t) => {
        const n = A(t);
        bt(n);
      },
      [bt, A]
    ), Pe = O(
      (t, n) => {
        (Bt == null ? void 0 : Bt(t, n)) !== !1 && bt(t);
      },
      [Bt, bt]
    ), Xe = (t) => {
      t.button === 0 && (t.preventDefault(), t.stopPropagation(), t.currentTarget.setPointerCapture(
        t.pointerId
      ), zt.current = t.pointerId, ae(t.clientX), Mt == null || Mt(lt.current));
    }, nn = (t) => {
      zt.current === t.pointerId && ae(t.clientX);
    }, rn = (t) => {
      zt.current === t.pointerId && (zt.current = null, Jt == null || Jt(lt.current));
    }, on = O(
      (t) => {
        if ((t.metaKey || t.ctrlKey) && t.key.toLowerCase() === "b") {
          t.preventDefault(), Se();
          return;
        }
        if (t.key === "[") {
          t.preventDefault(), e();
          return;
        }
        t.key === "]" && (t.preventDefault(), l());
      },
      [
        Se,
        e,
        l
      ]
    ), sn = O(
      (t) => ot ? ot(t) : null,
      [ot]
    ), ln = qt(() => typeof gt == "function" ? gt() : gt ?? null, [gt]);
    return /* @__PURE__ */ N.jsxs(
      "div",
      {
        ref: jt,
        className: "timeline-root",
        tabIndex: 0,
        onWheel: Pt,
        onKeyDown: on,
        onPointerDown: (t) => {
          t.target === t.currentTarget && It(null);
        },
        children: [
          /* @__PURE__ */ N.jsxs(
            "div",
            {
              className: "timeline-track-panel",
              style: { width: ht },
              children: [
                /* @__PURE__ */ N.jsx("div", { className: "timeline-track-panel-header", children: ln }),
                /* @__PURE__ */ N.jsx("div", { className: "timeline-track-panel-body", children: U.map((t) => {
                  const n = s[t.index];
                  if (!n) return null;
                  const r = t.top - Te - B.scrollTop;
                  if (r + t.height < -8 || r > B.height + 8)
                    return null;
                  const i = Array.isArray(n.classNames) ? n.classNames.filter(Boolean) : [];
                  return /* @__PURE__ */ N.jsx(
                    "div",
                    {
                      className: ["timeline-track-row", ...i].filter(Boolean).join(" "),
                      style: { top: r, height: t.height },
                      children: sn(n)
                    },
                    n.id
                  );
                }) })
              ]
            }
          ),
          /* @__PURE__ */ N.jsxs("div", { className: "timeline-main", style: { left: ht }, children: [
            /* @__PURE__ */ N.jsx("canvas", { ref: Nt, className: "timeline-bg-canvas" }),
            /* @__PURE__ */ N.jsx(
              "canvas",
              {
                ref: pe,
                onPointerDown: (t) => {
                  t.preventDefault();
                  const n = A(t.clientX);
                  Pe(
                    n,
                    t
                  );
                },
                onDoubleClick: (t) => {
                  t.preventDefault();
                  const n = A(t.clientX);
                  Pe(
                    n,
                    t
                  );
                },
                className: "timeline-ruler-canvas"
              }
            ),
            /* @__PURE__ */ N.jsx(
              "div",
              {
                className: "timeline-playhead-layer",
                style: { width: B.width, height: B.height },
                children: /* @__PURE__ */ N.jsxs(
                  "div",
                  {
                    ref: me,
                    onPointerDown: Xe,
                    onPointerMove: nn,
                    onPointerUp: rn,
                    className: "timeline-playhead",
                    children: [
                      /* @__PURE__ */ N.jsx("div", { className: "timeline-playhead-arrow" }),
                      /* @__PURE__ */ N.jsx("div", { className: "timeline-playhead-line" })
                    ]
                  }
                )
              }
            ),
            /* @__PURE__ */ N.jsx(
              "div",
              {
                ref: rt,
                className: "timeline-scroll timeline-scroll-area",
                onPointerDownCapture: (t) => {
                  if (!t.target.closest("[data-clip-id]")) {
                    It(null);
                    const r = se(t.clientY), i = r ? s.find((o) => o.id === r) : null;
                    i && (Qt == null || Qt(
                      t,
                      {
                        row: i,
                        time: A(t.clientX)
                      }
                    ));
                  }
                },
                onDoubleClickCapture: (t) => {
                  if (t.target.closest("[data-clip-id]")) return;
                  const r = se(t.clientY), i = r ? s.find((o) => o.id === r) : null;
                  i && (fe == null || fe(
                    t,
                    {
                      row: i,
                      time: A(t.clientX)
                    }
                  ));
                },
                children: /* @__PURE__ */ N.jsxs(
                  "div",
                  {
                    className: "timeline-content",
                    style: { width: Fe, height: ye },
                    children: [
                      At.map((t) => {
                        const n = Kt.get(t.id);
                        return !n || !!!t.hidden ? null : /* @__PURE__ */ N.jsx(
                          "div",
                          {
                            className: "timeline-row-dim-overlay",
                            style: { top: n.top, height: n.height }
                          },
                          `${t.id}-dim-overlay`
                        );
                      }),
                      At.map((t) => {
                        const n = Kt.get(t.id);
                        return !n || !!!t.locked ? null : /* @__PURE__ */ N.jsx(
                          "div",
                          {
                            className: "timeline-row-lock-overlay",
                            style: { top: n.top, height: n.height }
                          },
                          `${t.id}-lock-overlay`
                        );
                      }),
                      At.map((t) => /* @__PURE__ */ N.jsx(Ke.Fragment, { children: t.actions.map((n) => {
                        const r = (f == null ? void 0 : f.originRowId) === t.id && f.actionId === n.id, i = (m == null ? void 0 : m.rowId) === t.id && m.actionId === n.id, o = (ct == null ? void 0 : ct.rowId) === t.id && ct.actionId === n.id, a = !!t.hidden, u = i ? m.preview : n, b = Q(u.start, E), p = Math.max(
                          2,
                          Q(Ft(u), E)
                        ), I = Kt.get(t.id);
                        if (!I) return null;
                        const C = I.top, d = Math.max(14, I.height);
                        return /* @__PURE__ */ N.jsx(
                          In,
                          {
                            clip: n,
                            renderClip: u,
                            content: st == null ? void 0 : st(u, t),
                            left: b,
                            top: C,
                            width: p,
                            height: d,
                            isSelected: o,
                            isDraggedSource: r,
                            isDimmed: a,
                            onPointerDown: (P) => $(P, t.id, n),
                            onPointerMove: _,
                            onPointerUp: w,
                            onClick: (P) => {
                              P.stopPropagation(), It({
                                rowId: t.id,
                                actionId: n.id
                              });
                              const F = A(P.clientX);
                              Zt == null || Zt(P, {
                                action: n,
                                row: t,
                                time: F
                              }), Ut.current || ue == null || ue(P, {
                                action: n,
                                row: t,
                                time: F
                              }), Ut.current = !1;
                            },
                            onDoubleClick: (P) => {
                              P.stopPropagation();
                              const F = A(P.clientX);
                              bt(F), Vt == null || Vt(P, {
                                action: n,
                                row: t,
                                time: F
                              });
                            },
                            onTrimPointerDown: (P, F) => it(P, t.id, n, F),
                            onTrimPointerMove: K,
                            onTrimPointerUp: G
                          },
                          n.id
                        );
                      }) }, t.id)),
                      f && (() => {
                        var r, i;
                        const t = s.find((o) => o.id === f.previewRowId) ?? s.find((o) => o.id === f.originRowId) ?? s[0], n = t ? (Z == null ? void 0 : Z(f.action, t)) ?? (st == null ? void 0 : st(f.action, t)) : void 0;
                        return /* @__PURE__ */ N.jsx(
                          Tn,
                          {
                            clip: f.action,
                            content: n,
                            left: Q(f.previewStart, E),
                            top: ((r = Kt.get(f.previewRowId)) == null ? void 0 : r.top) ?? Te,
                            width: Math.max(
                              2,
                              Q(Ft(f.action), E)
                            ),
                            height: Math.max(
                              14,
                              ((i = Kt.get(f.previewRowId)) == null ? void 0 : i.height) ?? H
                            ),
                            isDropValid: f.isDropValid,
                            onPointerMove: _,
                            onPointerUp: w
                          }
                        );
                      })(),
                      (f == null ? void 0 : f.insertLineY) != null && /* @__PURE__ */ N.jsx(
                        "div",
                        {
                          className: "timeline-insert-line",
                          style: { transform: `translateY(${f.insertLineY}px)` }
                        }
                      ),
                      (f == null ? void 0 : f.snappedTime) != null && /* @__PURE__ */ N.jsx(
                        "div",
                        {
                          className: "timeline-snap-line",
                          style: {
                            transform: `translateX(${Q(f.snappedTime, E)}px)`
                          }
                        }
                      ),
                      (m == null ? void 0 : m.snappedTime) != null && /* @__PURE__ */ N.jsx(
                        "div",
                        {
                          className: "timeline-snap-line",
                          style: {
                            transform: `translateX(${Q(m.snappedTime, E)}px)`
                          }
                        }
                      )
                    ]
                  }
                )
              }
            )
          ] })
        ]
      }
    );
  }
);
bn.displayName = "Timeline";
export {
  bn as Timeline,
  vn as formatTime,
  yn as formatTimeWithMs,
  Q as frameToPixel,
  yt as pixelToFrame,
  yt as pixelToTime,
  Q as timeToPixel
};
