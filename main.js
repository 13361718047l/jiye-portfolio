/* ============================================================
   JIYE 集页 · 全站交互脚本
   滚动动画 / Toast / Modal / 收藏 / 筛选 / 轮播 / 灯箱
   数字计数 / 返回顶部 / 移动菜单 / 点赞 / 表单提示
   ============================================================ */
(function () {
  'use strict';
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  /* ---------- Toast 轻提示 ---------- */
  var toastEl = null;
  window.JYToast = function (msg) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'toast';
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastEl._t);
    toastEl._t = setTimeout(function () { toastEl.classList.remove('show'); }, 2200);
  };

  /* ---------- Modal 弹窗（由任意 [data-modal] 触发） ---------- */
  function ensureModal() {
    var m = $('#jy-modal');
    if (m) return m;
    m = document.createElement('div');
    m.className = 'modal-mask';
    m.id = 'jy-modal';
    m.innerHTML =
      '<div class="modal">' +
      '<div class="em" data-em>🎀</div>' +
      '<h3 data-title></h3>' +
      '<p data-desc></p>' +
      '<div class="btns">' +
      '<a class="btn btn-ghost" data-cancel>取消</a>' +
      '<a class="btn btn-pink" data-ok>确认</a>' +
      '</div></div>';
    document.body.appendChild(m);
    m.addEventListener('click', function (e) {
      if (e.target === m || e.target.hasAttribute('data-cancel')) m.classList.remove('show');
    });
    return m;
  }
  window.JYModal = function (opt) {
    var m = ensureModal();
    $('[data-em]', m).textContent = opt.em || '🎀';
    $('[data-title]', m).textContent = opt.title || '提示';
    $('[data-desc]', m).textContent = opt.desc || '';
    var ok = $('[data-ok]', m);
    ok.textContent = opt.okText || '确认';
    ok.href = opt.okHref || '#';
    ok.onclick = function () {
      if (opt.onOk) { opt.onOk(); m.classList.remove('show'); return false; }
      if (!opt.okHref) { m.classList.remove('show'); return false; }
    };
    m.classList.add('show');
  };

  /* ---------- 收藏爱心 ---------- */
  document.addEventListener('click', function (e) {
    var fav = e.target.closest('.fav-btn');
    if (fav) {
      fav.classList.toggle('on');
      JYToast(fav.classList.contains('on') ? '已加入收藏 ♥' : '已取消收藏');
      e.preventDefault();
    }
  });

  /* ---------- chips 筛选（通用） ---------- */
  $$('.chips').forEach(function (group) {
    group.addEventListener('click', function (e) {
      var chip = e.target.closest('.chip');
      if (!chip) return;
      $$('.chip', group).forEach(function (c) { c.classList.remove('active'); });
      chip.classList.add('active');
      // 若页面有 data-filter 卡片则实时过滤
      var key = chip.getAttribute('data-filter');
      if (key) {
        var count = 0;
        $$('[data-cat]').forEach(function (card) {
          var show = key === 'all' || card.getAttribute('data-cat') === key;
          card.style.display = show ? '' : 'none';
          if (show) count++;
        });
        var meta = $('#filter-count');
        if (meta) meta.textContent = count;
        JYToast('筛选：' + chip.textContent.trim());
      }
    });
  });

  /* ---------- 轮播 ---------- */
  $$('.carousel').forEach(function (car) {
    var track = $('.carousel-track', car);
    var slides = $$('.carousel-slide', car);
    var dotsBox = $('.carousel-dots', car);
    var idx = 0, timer;
    if (dotsBox) {
      dotsBox.innerHTML = slides.map(function (_, i) {
        return '<button data-i="' + i + '"></button>';
      }).join('');
    }
    function go(i) {
      idx = (i + slides.length) % slides.length;
      track.style.transform = 'translateX(-' + idx * 100 + '%)';
      $$('button', dotsBox).forEach(function (d, di) { d.classList.toggle('on', di === idx); });
    }
    function auto() { timer = setInterval(function () { go(idx + 1); }, 4200); }
    if (dotsBox) dotsBox.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      clearInterval(timer); go(+b.getAttribute('data-i')); auto();
    });
    var prev = $('.carousel-arrow.prev', car), next = $('.carousel-arrow.next', car);
    if (prev) prev.onclick = function () { clearInterval(timer); go(idx - 1); auto(); };
    if (next) next.onclick = function () { clearInterval(timer); go(idx + 1); auto(); };
    go(0); auto();
    car.addEventListener('mouseenter', function () { clearInterval(timer); });
    car.addEventListener('mouseleave', auto);
  });

  /* ---------- 灯箱 ---------- */
  var lb = document.createElement('div');
  lb.className = 'lightbox';
  lb.innerHTML = '<span class="lb-close">✕</span><div class="lb-emoji"></div>';
  document.body.appendChild(lb);
  function closeLb() { lb.classList.remove('show'); }
  $('.lb-close', lb).onclick = closeLb;
  lb.addEventListener('click', function (e) { if (e.target === lb) closeLb(); });
  document.addEventListener('click', function (e) {
    var zoom = e.target.closest('[data-zoom]');
    if (!zoom) return;
    $('.lb-emoji', lb).textContent = zoom.getAttribute('data-zoom') || zoom.textContent;
    lb.classList.add('show');
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeLb(); });

  /* ---------- 滚动进入动画 ---------- */
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
      });
    }, { threshold: 0.12 });
    $$('.reveal').forEach(function (el) { io.observe(el); });
  } else {
    $$('.reveal').forEach(function (el) { el.classList.add('in'); });
  }

  /* ---------- 数字计数动画 ---------- */
  function countUp(el) {
    var raw = el.getAttribute('data-count');
    var target = parseFloat(raw);
    var suffix = el.getAttribute('data-suffix') || '';
    var dur = 1400, start = null, finished = false;
    function finish() {
      if (finished) return;
      finished = true;
      el.textContent = target.toLocaleString() + suffix;
    }
    function frame(ts) {
      if (finished) return;
      if (!start) start = ts;
      var p = Math.min((ts - start) / dur, 1);
      var ease = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.floor(target * ease).toLocaleString() + suffix;
      if (p < 1) requestAnimationFrame(frame);
      else finish();
    }
    requestAnimationFrame(frame);
    setTimeout(finish, dur + 300); // 兜底
  }
  if ('IntersectionObserver' in window) {
    var cio = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { countUp(en.target); cio.unobserve(en.target); }
      });
    }, { threshold: 0.5 });
    $$('[data-count]').forEach(function (el) { cio.observe(el); });
  }

  /* ---------- 返回顶部 ---------- */
  var topBtn = document.createElement('button');
  topBtn.className = 'to-top';
  topBtn.innerHTML = '↑';
  topBtn.setAttribute('aria-label', '返回顶部');
  document.body.appendChild(topBtn);
  window.addEventListener('scroll', function () {
    topBtn.classList.toggle('show', window.scrollY > 480);
  }, { passive: true });
  topBtn.onclick = function () { window.scrollTo({ top: 0, behavior: 'smooth' }); };

  /* ---------- 移动端菜单 ---------- */
  var burger = $('.burger');
  if (burger) {
    var mm = document.createElement('div');
    mm.className = 'mobile-menu';
    var links = $$('.nav-links a').map(function (a) {
      return '<a href="' + a.href + '"' + (a.classList.contains('active') ? ' class="active"' : '') + '>' + a.textContent + '</a>';
    }).join('');
    mm.innerHTML = '<div class="panel"><div style="font-weight:900;font-size:20px;margin-bottom:14px">集页 JIYE</div>' +
      links + '<a href="login.html">登录 / 注册</a></div>';
    document.body.appendChild(mm);
    burger.onclick = function () { mm.classList.add('show'); };
    mm.addEventListener('click', function (e) { if (e.target === mm) mm.classList.remove('show'); });
  }

  /* ---------- 社区点赞 ---------- */
  document.addEventListener('click', function (e) {
    var like = e.target.closest('[data-like]');
    if (!like) return;
    var n = $('.like-n', like);
    var num = n ? parseInt(n.textContent, 10) : 0;
    var on = like.classList.toggle('liked');
    if (n) n.textContent = num + (on ? 1 : -1);
  });

  /* ---------- 开关 switch ---------- */
  document.addEventListener('click', function (e) {
    var sw = e.target.closest('.switch');
    if (sw) sw.classList.toggle('on');
  });

  /* ---------- 模板详情：预览图 tab 切换 ---------- */
  $$('.shot-tabs').forEach(function (box) {
    box.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      $$('button', box).forEach(function (x) { x.classList.remove('on'); });
      b.classList.add('on');
      var screen = $('#td-screen');
      if (screen) {
        screen.className = 'screen ' + b.getAttribute('data-grad');
        screen.innerHTML = '<span style="font-size:90px">' + b.getAttribute('data-emoji') + '</span>';
      }
    });
  });

  /* ---------- 登录 tab ---------- */
  $$('.auth-tabs').forEach(function (box) {
    box.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      $$('button', box).forEach(function (x) { x.classList.remove('on'); });
      b.classList.add('on');
      var h = $('#auth-title');
      if (h) h.textContent = b.textContent.indexOf('注册') > -1 ? '创建你的账号' : '欢迎回来';
    });
  });

  /* ---------- 搜索框 ---------- */
  $$('[data-enter-search]').forEach(function (input) {
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && input.value.trim()) {
        location.href = 'search.html?q=' + encodeURIComponent(input.value.trim());
      }
    });
  });

  /* ---------- 表单保存提示 ---------- */
  $$('[data-save-toast]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      JYToast(btn.getAttribute('data-save-toast') || '已保存 ✓');
    });
  });

  /* ---------- “使用模板”确认弹窗 ---------- */
  $$('[data-use-template]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var name = btn.getAttribute('data-use-template') || '该模板';
      JYModal({
        em: '🎀',
        title: '使用「' + name + '」？',
        desc: '将复制该模板到你的作品集，之后可以自由替换图片和文字。',
        okText: '立即使用',
        okHref: 'editor.html'
      });
    });
  });

  /* ---------- 复制链接 ---------- */
  $$('[data-copy]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var text = btn.getAttribute('data-copy');
      function done() { JYToast('链接已复制，去粘贴分享吧 🔗'); }
      if (navigator.clipboard) navigator.clipboard.writeText(text).then(done).catch(fallback);
      else fallback();
      function fallback() {
        var ta = document.createElement('textarea');
        ta.value = text; document.body.appendChild(ta); ta.select();
        try { document.execCommand('copy'); done(); } catch (e) { JYToast('复制失败，请手动复制'); }
        ta.remove();
      }
    });
  });

  /* ---------- 作品集内页导航（pf-shell 内无刷新切换） ---------- */
  $$('.pf-nav').forEach(function (nav) {
    nav.addEventListener('click', function (e) {
      var a = e.target.closest('a'); if (!a) return;
      e.preventDefault();
      $$('a', nav).forEach(function (x) { x.classList.remove('on'); });
      a.classList.add('on');
      var target = $(a.getAttribute('href'));
      if (target) target.scrollIntoView({ behavior: 'smooth' });
    });
  });

})();
