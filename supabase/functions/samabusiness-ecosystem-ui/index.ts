import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const VERSION = "12.2.0";
function ecosystem() {
  'use strict';
  if (window.__SAMA_ECOSYSTEM_UI_V1220__) return;
  window.__SAMA_ECOSYSTEM_UI_V1220__ = true;
  const VERSION = '12.2.0';
  const state = {
    lang: localStorage.getItem('sama-ui-lang') === 'wo' ? 'wo' : 'fr'
  };
  const icons = {
    sale: 'M4 6h16v13H4z M8 6V4h8v2 M8 11h8 M8 15h5',
    voice: 'M12 3a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3 M6 10v1a6 6 0 0 0 12 0v-1 M12 17v4',
    orders: 'M4 7l8-4 8 4-8 4z M4 7v10l8 4 8-4V7 M12 11v10',
    debts: 'M5 5h14v14H5z M8 9h8 M8 13h5 M8 17h4',
    stock: 'M4 8l8-4 8 4-8 4z M4 8v9l8 4 8-4V8',
    expenses: 'M5 4h14v16H5z M8 8h8 M8 12h8 M8 16h5',
    clients: 'M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6 M16 10a2.5 2.5 0 1 0 0-5 M3 20c0-4 2-6 5-6s5 2 5 6 M13 15c3-2 7 0 8 4',
    delivery: 'M3 6h11v10H3z M14 10h4l3 3v3h-7z M7 19a2 2 0 1 0 0-4 M18 19a2 2 0 1 0 0-4',
    tracking: 'M12 21s6-5 6-11a6 6 0 1 0-12 0c0 6 6 11 6 11 M12 12a2 2 0 1 0 0-4',
    dashboard: 'M4 20V10 M10 20V4 M16 20v-7 M22 20H2',
    profit: 'M12 3v18 M16 7c0-2-2-3-4-3s-4 1-4 3 2 3 4 3 4 1 4 3-2 4-4 4-4-1-4-3',
    reports: 'M6 3h9l3 3v15H6z M9 11h6 M9 15h6 M9 7h3',
    site: 'M4 5h16v14H4z M4 9h16 M8 14h3 M14 14h2',
    admin: 'M12 3l8 4v5c0 5-3 8-8 10-5-2-8-5-8-10V7z M9 12l2 2 4-5',
    suppliers: 'M4 20V9l5-4v4l5-4v4l6-3v14z M8 14h2 M14 14h2',
    help: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20 M9.5 9a2.8 2.8 0 1 1 4.4 2.3c-1.4 1-1.9 1.5-1.9 2.7 M12 18h.01',
    settings: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M4 12l-2 1 2 4 2-1 2 1 1 3h6l1-3 2-1 2 1 2-4-2-1v-2l2-1-2-4-2 1-2-1-1-3H9L8 7 6 8 4 7 2 11l2 1z'
  };
  function icon(name, size = 22) {
    const path = icons[name] || icons.site;
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false" style="width:' + size + 'px;height:' + size + 'px;min-width:' + size + 'px;min-height:' + size + 'px;max-width:' + size + 'px;max-height:' + size + 'px;display:block;flex:none;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round"><path d="' + path + '"/></svg>';
  }
  const groups = [
    {
      fr: 'Vendre',
      wo: 'Jaay',
      items: [
        {
          id: 'sale',
          fr: 'Nouvelle vente',
          wo: 'Jaay bu bees'
        },
        {
          id: 'voice',
          fr: 'Commande vocale',
          wo: 'Waxal'
        },
        {
          id: 'orders',
          fr: 'Commandes',
          wo: 'Komànd yi'
        }
      ]
    },
    {
      fr: 'Gérer',
      wo: 'Saytu',
      items: [
        {
          id: 'debts',
          fr: 'Cahier & dettes',
          wo: 'Bor yi'
        },
        {
          id: 'stock',
          fr: 'Stock',
          wo: 'Stock'
        },
        {
          id: 'expenses',
          fr: 'Dépenses',
          wo: 'Xaalis bu génn'
        },
        {
          id: 'clients',
          fr: 'Clients',
          wo: 'Jëndkat yi'
        }
      ]
    },
    {
      fr: 'Livrer',
      wo: 'Yónnee',
      items: [
        {
          id: 'delivery',
          fr: 'Livraisons',
          wo: 'Yónnee yi'
        },
        {
          id: 'tracking',
          fr: 'Suivi',
          wo: 'Toppandoo'
        }
      ]
    },
    {
      fr: 'Suivre',
      wo: 'Xool',
      items: [
        {
          id: 'dashboard',
          fr: 'Mes chiffres',
          wo: 'Xool liggéey bi'
        },
        {
          id: 'profit',
          fr: 'Bénéfice réel',
          wo: 'Waal bi'
        },
        {
          id: 'reports',
          fr: 'Rapports',
          wo: 'Nettali'
        }
      ]
    },
    {
      fr: 'Grandir',
      wo: 'Yokk',
      items: [
        {
          id: 'site',
          fr: 'Créer mon site',
          wo: 'Sos sama site'
        },
        {
          id: 'admin',
          fr: 'Mes sites',
          wo: 'Sama site yi'
        },
        {
          id: 'suppliers',
          fr: 'Fournisseurs',
          wo: 'Joxkat yi'
        }
      ]
    },
    {
      fr: 'Aide',
      wo: 'Ndimbël',
      items: [
        {
          id: 'help',
          fr: 'Assistance',
          wo: 'Ndimbël'
        },
        {
          id: 'settings',
          fr: 'Réglages',
          wo: 'Tànneef'
        }
      ]
    }
  ];
  const CSS = `
#sama-eco-root{--e-ink:#10231c;--e-green:#075f45;--e-green2:#087a45;--e-gold:#d8a83d;--e-bg:#f5f8f5;--e-muted:#69766f;--e-line:rgba(16,35,28,.1);font-family:Inter,Poppins,system-ui,-apple-system,"Segoe UI",sans-serif;color:var(--e-ink)}#sama-eco-root *{box-sizing:border-box}
#sama-eco-root .eco-fab{position:fixed;right:12px;bottom:calc(82px + env(safe-area-inset-bottom));z-index:880;border:1px solid rgba(255,255,255,.18);border-radius:18px;min-height:54px;padding:8px 13px;background:linear-gradient(135deg,#10231c,#075f45);color:#fff;display:flex;align-items:center;gap:8px;font:900 12px inherit;box-shadow:0 16px 40px rgba(7,50,37,.28);cursor:pointer}#sama-eco-root .eco-fab span{width:34px;height:34px;border-radius:12px;background:rgba(255,255,255,.12);display:grid;place-items:center}
#sama-eco-root .eco-layer{position:fixed;inset:0;z-index:2147483400;background:rgba(7,24,18,.72);backdrop-filter:blur(12px);display:none;padding:10px}#sama-eco-root .eco-layer.open{display:grid;place-items:center}#sama-eco-root .eco-shell{width:min(1120px,100%);height:min(900px,100%);background:var(--e-bg);border:1px solid rgba(255,255,255,.6);border-radius:28px;overflow:hidden;display:grid;grid-template-rows:auto 1fr;box-shadow:0 30px 90px rgba(0,0,0,.3)}
#sama-eco-root .eco-head{padding:13px 15px;background:radial-gradient(circle at 82% 0,rgba(216,168,61,.28),transparent 26%),linear-gradient(120deg,#10231c,#075f45);color:#fff;display:flex;align-items:center;gap:10px}#sama-eco-root .eco-logo{width:43px;height:43px;border-radius:14px;background:linear-gradient(145deg,#f4d276,#d7a33b);color:#14231d;display:grid;place-items:center;font-size:15px;font-weight:950}#sama-eco-root .eco-head h2{font-size:15px;margin:0}#sama-eco-root .eco-head p{font-size:10px;opacity:.72;margin:2px 0 0}#sama-eco-root .eco-tools{margin-left:auto;display:flex;gap:6px}#sama-eco-root .eco-tool{border:1px solid rgba(255,255,255,.17);background:rgba(255,255,255,.08);color:#fff;border-radius:12px;min-height:40px;min-width:40px;padding:7px 9px;font-weight:900;cursor:pointer}
#sama-eco-root .eco-main{overflow:auto;padding:20px}#sama-eco-root .eco-welcome{margin-bottom:13px}#sama-eco-root .eco-kicker{font-size:10px;letter-spacing:.12em;color:var(--e-green);font-weight:950}#sama-eco-root .eco-welcome h1{margin:5px 0 0;font-size:clamp(28px,5vw,46px);line-height:1;letter-spacing:-.055em}#sama-eco-root .eco-welcome p{margin:7px 0 0;color:var(--e-muted);font-size:13px}
#sama-eco-root .eco-growth{display:grid;grid-template-columns:minmax(0,1.4fr) auto;align-items:center;gap:16px;margin:0 0 15px;padding:17px 18px;border-radius:23px;background:radial-gradient(circle at 88% 10%,rgba(216,168,61,.3),transparent 35%),linear-gradient(135deg,#10231c,#075f45);color:#fff;box-shadow:0 15px 40px rgba(7,62,45,.15)}#sama-eco-root .eco-growth small{font-weight:900;letter-spacing:.08em;color:#f2d98c}#sama-eco-root .eco-growth h3{margin:5px 0 4px;font-size:1.35rem;letter-spacing:-.04em}#sama-eco-root .eco-growth p{margin:0;color:rgba(255,255,255,.74);font-size:12px}#sama-eco-root .eco-growth-actions{display:flex;gap:7px}#sama-eco-root .eco-growth button{min-height:48px;border-radius:14px;padding:9px 12px;font:900 12px inherit;cursor:pointer}.eco-growth-primary{border:0;background:linear-gradient(135deg,#f2d276,#d7a33b);color:#14231d}.eco-growth-secondary{border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.08);color:#fff}
#sama-eco-root .eco-quick{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:14px}#sama-eco-root .eco-quick button{min-height:68px;border:1px solid var(--e-line);border-radius:17px;background:#fff;padding:10px;display:flex;align-items:center;gap:9px;text-align:left;font:850 12px inherit;box-shadow:0 7px 20px rgba(16,35,28,.04);cursor:pointer}#sama-eco-root .eco-quick i,#sama-eco-root .eco-card i{width:36px;height:36px;flex:0 0 36px;border-radius:12px;background:#e9f5ef;color:#075f45;display:grid;place-items:center;font-style:normal}
#sama-eco-root .eco-groups{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:10px!important}#sama-eco-root .eco-group{background:rgba(255,255,255,.93)!important;border:1px solid var(--e-line)!important;border-radius:21px!important;padding:13px!important;box-shadow:0 8px 24px rgba(16,35,28,.04)!important}#sama-eco-root .eco-group-title{font-weight:950;margin-bottom:9px;font-size:13px}#sama-eco-root .eco-group-title small{color:var(--e-muted);font-size:9px;margin-left:5px;font-weight:750}#sama-eco-root .eco-items{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:7px!important}#sama-eco-root .eco-card{min-height:76px!important;border:1px solid rgba(16,35,28,.055)!important;border-radius:15px!important;background:#f8faf8!important;padding:9px!important;display:flex!important;align-items:center!important;gap:8px!important;text-align:left!important;font:850 11px inherit!important;cursor:pointer!important}#sama-eco-root .eco-card strong{font-size:inherit!important}#sama-eco-root .eco-card small{display:block;color:var(--e-muted);font-size:9px;margin-top:2px}
#sama-eco-root .eco-bottom{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(7px + env(safe-area-inset-bottom));z-index:870;width:min(570px,calc(100% - 18px));display:grid;grid-template-columns:repeat(5,1fr);gap:4px;padding:6px;background:rgba(255,255,255,.94);backdrop-filter:blur(18px);border:1px solid var(--e-line);border-radius:19px;box-shadow:0 16px 42px rgba(16,35,28,.14)}#sama-eco-root .eco-bottom button{border:0;background:transparent;border-radius:12px;min-height:48px;font:850 10px inherit;color:#5f6d66;cursor:pointer}#sama-eco-root.eco-suspended>.eco-fab,#sama-eco-root.eco-suspended>.eco-bottom{opacity:0;visibility:hidden;pointer-events:none!important}
#sama-site-launch-card{position:relative;overflow:hidden;margin:10px 0 15px;padding:16px 17px;border:1px solid rgba(255,255,255,.55);border-radius:23px;background:radial-gradient(circle at 94% 8%,rgba(216,168,61,.26),transparent 36%),linear-gradient(135deg,#10231c,#075f45 72%,#087a45);color:#fff;box-shadow:0 16px 42px rgba(7,67,48,.15);font-family:Inter,Poppins,system-ui,-apple-system,"Segoe UI",sans-serif}#sama-site-launch-card *{box-sizing:border-box}#sama-site-launch-card .sl-kicker{font-size:9px;font-weight:950;letter-spacing:.12em;color:#f2d98c}#sama-site-launch-card .sl-row{display:flex;align-items:flex-end;gap:15px;justify-content:space-between}#sama-site-launch-card h3{margin:6px 0 5px;font-size:clamp(21px,4.5vw,30px);line-height:1.02;letter-spacing:-.045em}#sama-site-launch-card p{margin:0;max-width:620px;color:rgba(255,255,255,.78);font-size:12px;line-height:1.5}#sama-site-launch-card .sl-actions{display:flex;gap:7px;flex:0 0 auto}#sama-site-launch-card button{min-height:48px;border-radius:14px;padding:10px 13px;font:900 12px system-ui;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:7px}#sama-site-launch-card .sl-primary{border:0;background:linear-gradient(135deg,#f2d276,#d7a33b);color:#14231d;box-shadow:0 10px 26px rgba(0,0,0,.14)}#sama-site-launch-card .sl-secondary{border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.08);color:#fff}#sama-site-launch-card .sl-note{display:flex;align-items:center;gap:7px;margin-top:10px;font-size:10px;color:rgba(255,255,255,.74)}#sama-site-launch-card .sl-note svg{width:15px!important;height:15px!important;min-width:15px!important;min-height:15px!important;max-width:15px!important;max-height:15px!important;display:block!important;flex:none!important}.sama-eco-duplicate-title{display:none!important}
@media(max-width:760px){#sama-eco-root .eco-layer{padding:0!important}#sama-eco-root .eco-shell{height:100%!important;border-radius:0!important;border:0!important}#sama-eco-root .eco-main{padding:14px 11px 96px!important}#sama-eco-root .eco-head{padding:10px 11px!important}#sama-eco-root .eco-welcome h1{font-size:30px!important}#sama-eco-root .eco-growth{grid-template-columns:1fr!important;padding:14px!important}#sama-eco-root .eco-growth-actions{display:grid!important;grid-template-columns:1fr 1fr!important}#sama-eco-root .eco-quick{grid-template-columns:1fr 1fr!important}#sama-eco-root .eco-groups{grid-template-columns:1fr!important;gap:9px!important}#sama-eco-root .eco-items{grid-template-columns:1fr 1fr!important}#sama-eco-root .eco-group{padding:11px!important}#sama-eco-root .eco-card{min-height:70px!important}#sama-eco-root .eco-bottom{width:calc(100% - 14px)!important}#sama-site-launch-card{padding:15px!important;border-radius:21px!important}#sama-site-launch-card .sl-row{display:block!important}#sama-site-launch-card .sl-actions{display:grid!important;grid-template-columns:1.25fr .75fr!important;margin-top:13px!important}#sama-site-launch-card button{width:100%!important}}
@media(max-width:390px){#sama-eco-root .eco-items{grid-template-columns:1fr!important}#sama-site-launch-card .sl-actions{grid-template-columns:1fr!important}}@media(prefers-reduced-motion:reduce){#sama-eco-root *,#sama-site-launch-card *{transition:none!important;animation:none!important}}
`;
  function installStyle() {
    let s = document.querySelector('#sama-ecosystem-v1220-style');
    if (!s) {
      s = document.createElement('style');
      s.id = 'sama-ecosystem-v1220-style';
      document.head.append(s);
    }
    s.textContent = CSS;
  }
  function tr(obj) {
    return obj?.[state.lang] || obj?.fr || '';
  }
  function isVisible(el) {
    if (!el) return false;
    const r = el.getBoundingClientRect(), s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.display !== 'none' && s.visibility !== 'hidden';
  }
  function findAndClick(words) {
    const nodes = [
      ...document.querySelectorAll('button,a,[role=button],.quick,.more-card,.nav-btn,.mini-btn')
    ].filter((n)=>!n.closest('#sama-eco-root') && isVisible(n));
    for (const word of words){
      const key = word.toLowerCase();
      const node = nodes.find((n)=>(n.textContent || '').trim().toLowerCase().includes(key));
      if (node) {
        node.click();
        return true;
      }
    }
    return false;
  }
  function close() {
    document.querySelector('#eco-layer')?.classList.remove('open');
    document.documentElement.style.overflow = '';
    syncLayering();
  }
  function open() {
    render();
    document.querySelector('#eco-layer')?.classList.add('open');
    document.documentElement.style.overflow = 'hidden';
  }
  function openStudio(tab = 'create', voice = false) {
    close();
    if (voice) sessionStorage.setItem('sama-site-auto-voice', '1');
    if (window.SAMABUSINESS?.siteStudio?.open) {
      window.SAMABUSINESS.siteStudio.open();
      setTimeout(()=>{
        if (tab === 'sites') document.querySelector('#ss-root [data-tab="sites"],#ss-root .ss-tab:nth-child(2)')?.click();
        if (tab === 'admin') document.querySelector('#ss-root [data-tab="admin"]')?.click();
        if (voice) {
          const b = document.querySelector('#ss-root [data-s23="voice"]');
          if (b) {
            sessionStorage.removeItem('sama-site-auto-voice');
            b.click();
          }
        }
      }, 650);
      return;
    }
    location.href = tab === 'create' ? '/?module=site-studio' : '/?module=site-studio&tab=' + encodeURIComponent(tab);
  }
  function externalModalOpen() {
    return [
      ...document.querySelectorAll('[role="dialog"],.modal,.sheet,.drawer,[id$="Modal"],[id$="-modal"]')
    ].some((el)=>!el.closest('#sama-eco-root') && el.id !== 'ss-root' && el.getAttribute('aria-hidden') !== 'true' && !el.classList.contains('hidden') && isVisible(el));
  }
  function syncLayering() {
    document.querySelector('#sama-eco-root')?.classList.toggle('eco-suspended', externalModalOpen());
  }
  function action(id) {
    if (id === 'site') {
      openStudio('create');
      return;
    }
    if (id === 'admin') {
      openStudio('sites');
      return;
    }
    close();
    const map = {
      sale: [
        'nouvelle vente',
        'ajouter une vente'
      ],
      voice: [
        'commande vocale',
        'vocal'
      ],
      orders: [
        'commandes whatsapp',
        'commandes'
      ],
      debts: [
        'cahier & dettes',
        'dettes'
      ],
      stock: [
        'stock',
        'produits'
      ],
      expenses: [
        'dépenses',
        'depenses'
      ],
      clients: [
        'clients'
      ],
      delivery: [
        'livraison',
        'livraisons'
      ],
      tracking: [
        'suivi livraison',
        'suivi'
      ],
      dashboard: [
        'pilotage général',
        'tableau de bord',
        'pilotage'
      ],
      profit: [
        'bénéfice réel',
        'benefice reel'
      ],
      reports: [
        'rapports'
      ],
      suppliers: [
        'fournisseurs'
      ],
      help: [
        'assistance',
        'support',
        'aide'
      ],
      settings: [
        'réglages',
        'paramètres',
        'parametres'
      ]
    };
    if (findAndClick(map[id] || [])) return;
    if (id === 'sale') {
      location.href = '/?action=sale';
      return;
    }
    if (id === 'debts') {
      location.href = '/?module=debts';
      return;
    }
    if (id === 'voice') {
      location.href = '/?module=voice';
      return;
    }
    if (id === 'delivery') {
      location.href = '/?module=delivery';
      return;
    }
    setTimeout(open, 150);
  }
  function speak() {
    if (!('speechSynthesis' in window)) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(state.lang === 'wo' ? 'Tànnal li nga bëgg def. Man nga jaay, saytu stock, walla sos sa site.' : 'Choisissez ce que vous voulez faire. Vous pouvez vendre, gérer votre stock ou créer votre site.');
    u.lang = 'fr-SN';
    u.rate = .88;
    speechSynthesis.speak(u);
  }
  function itemHtml(i) {
    return '<button class="eco-card" data-eco-action="' + i.id + '"><i>' + icon(i.id, 20) + '</i><span><strong>' + tr(i) + '</strong><small>' + (state.lang === 'wo' ? i.fr : i.wo) + '</small></span></button>';
  }
  function render() {
    const main = document.querySelector('#eco-main');
    if (!main) return;
    const quick = [
      'sale',
      'debts',
      'stock',
      'delivery'
    ].map((id)=>groups.flatMap((g)=>g.items).find((x)=>x.id === id));
    main.innerHTML = '<div class="eco-welcome"><div class="eco-kicker">SAMA BUSINESS</div><h1>' + (state.lang === 'wo' ? 'Lan nga bëgg def?' : 'Que voulez-vous faire ?') + '</h1><p>' + (state.lang === 'wo' ? 'Tànnal jëf ji. Du laaj jang lu bari.' : 'Une action claire à la fois. SAMA vous guide.') + '</p></div><section class="eco-growth"><div><small>✦ GRANDIR</small><h3>Créez votre site sans technicien</h3><p>Parlez de votre activité. SAMA prépare le contenu, WhatsApp et les contacts.</p></div><div class="eco-growth-actions"><button class="eco-growth-primary" data-eco-action="site">Créer mon site</button><button class="eco-growth-secondary" data-eco-action="admin">Mes sites</button></div></section><div class="eco-quick">' + quick.map((i)=>'<button data-eco-action="' + i.id + '"><i>' + icon(i.id, 20) + '</i><span>' + tr(i) + '<br><small>' + (state.lang === 'wo' ? i.fr : i.wo) + '</small></span></button>').join('') + '</div><div class="eco-groups">' + groups.map((g)=>'<section class="eco-group"><div class="eco-group-title">' + tr(g) + ' <small>' + (state.lang === 'wo' ? g.fr : g.wo) + '</small></div><div class="eco-items">' + g.items.map(itemHtml).join('') + '</div></section>').join('') + '</div>';
    const langBtn = document.querySelector('#eco-lang');
    if (langBtn) langBtn.textContent = state.lang === 'wo' ? 'FR' : 'WO';
  }
  function normalized(v) {
    return String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
  }
  function dedupeTitles(shell) {
    const titles = [
      ...shell.querySelectorAll('h1,h2,h3,h4,strong')
    ].filter((el)=>normalized(el.textContent) === 'ce qu il faut faire maintenant');
    titles.forEach((el, i)=>el.classList.toggle('sama-eco-duplicate-title', i > 0));
  }
  function mountHomeSiteCard() {
    const shell = document.querySelector('#appShell');
    if (!shell) return;
    const existing = document.querySelector('#sama-site-launch-card');
    if (existing?.dataset.version === VERSION) {
      dedupeTitles(shell);
      return;
    }
    existing?.remove();
    const quick = [
      ...shell.querySelectorAll('.quick')
    ].find((el)=>/nouvelle vente/i.test(el.textContent || '')) || shell.querySelector('.quick');
    if (!quick) return;
    const grid = quick.parentElement;
    if (!grid || grid.querySelectorAll('.quick').length < 2) return;
    const card = document.createElement('section');
    card.id = 'sama-site-launch-card';
    card.dataset.version = VERSION;
    card.setAttribute('aria-label', 'Créer votre site professionnel');
    card.innerHTML = '<div class="sl-kicker">✦ SAMA SITE</div><div class="sl-row"><div><h3>Créez votre site en parlant</h3><p>Dites votre activité, vos produits et votre WhatsApp. SAMA organise le reste pour vous.</p></div><div class="sl-actions"><button class="sl-primary" data-site-launch="voice">' + icon('voice', 16) + ' Parler & créer</button><button class="sl-secondary" data-site-launch="sites">Mes sites</button></div></div><div class="sl-note">' + icon('site', 15) + ' Sans technicien · adapté au téléphone · WhatsApp intégré</div>';
    const heading = [
      ...shell.querySelectorAll('h1,h2,h3,h4,strong')
    ].find((el)=>normalized(el.textContent) === 'ce qu il faut faire maintenant');
    if (heading?.parentNode) heading.parentNode.insertBefore(card, heading);
    else grid.parentNode.insertBefore(card, grid);
    dedupeTitles(shell);
  }
  function bindRoot(root) {
    if (root.dataset.v122Bound) return;
    root.dataset.v122Bound = '1';
    root.addEventListener('click', (event)=>{
      const button = event.target.closest('button');
      if (!button) return;
      if (button.id === 'eco-open' || button.hasAttribute('data-eco-open')) {
        open();
        return;
      }
      if (button.id === 'eco-close') {
        close();
        return;
      }
      if (button.id === 'eco-listen') {
        speak();
        return;
      }
      if (button.id === 'eco-lang') {
        state.lang = state.lang === 'fr' ? 'wo' : 'fr';
        localStorage.setItem('sama-ui-lang', state.lang);
        render();
        return;
      }
      if (button.dataset.ecoAction) {
        action(button.dataset.ecoAction);
        return;
      }
    });
  }
  function mount() {
    installStyle();
    let root = document.querySelector('#sama-eco-root');
    if (root) {
      render();
      bindRoot(root);
      mountHomeSiteCard();
      syncLayering();
      return;
    }
    root = document.createElement('div');
    root.id = 'sama-eco-root';
    root.innerHTML = '<button class="eco-fab" id="eco-open" aria-label="Ouvrir le menu Sama"><span>☰</span><em>SAMA</em></button><div class="eco-layer" id="eco-layer" role="dialog" aria-modal="true" aria-label="Menu Sama Business"><section class="eco-shell"><header class="eco-head"><div class="eco-logo">SB</div><div><h2>Sama Business</h2><p>Votre activité, au même endroit</p></div><div class="eco-tools"><button class="eco-tool" id="eco-listen" aria-label="Écouter">◉</button><button class="eco-tool" id="eco-lang">WO</button><button class="eco-tool" id="eco-close" aria-label="Fermer">×</button></div></header><main class="eco-main" id="eco-main"></main></section></div><nav class="eco-bottom" aria-label="Navigation principale"><button data-eco-open>Accueil</button><button data-eco-action="sale">Ventes</button><button data-eco-action="stock">Stock</button><button data-eco-action="debts">Dettes</button><button data-eco-open>Plus</button></nav>';
    document.body.append(root);
    render();
    bindRoot(root);
    mountHomeSiteCard();
    syncLayering();
    window.SAMABUSINESS = Object.assign(window.SAMABUSINESS || {}, {
      ecosystemUI: {
        version: VERSION,
        open,
        lang: ()=>state.lang
      },
      openSiteStudio: openStudio
    });
  }
  document.addEventListener('click', (event)=>{
    const button = event.target.closest('[data-site-launch]');
    if (!button) return;
    event.preventDefault();
    const mode = button.dataset.siteLaunch;
    if (mode === 'voice') openStudio('create', true);
    else openStudio(mode === 'sites' ? 'sites' : 'create');
  }, true);
  document.addEventListener('keydown', (event)=>{
    if (event.key === 'Escape') close();
  });
  let scheduled = false;
  const schedule = ()=>{
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(()=>{
      scheduled = false;
      installStyle();
      mountHomeSiteCard();
      syncLayering();
    });
  };
  new MutationObserver(schedule).observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: [
      'class',
      'hidden',
      'aria-hidden'
    ]
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, {
    once: true
  });
  else mount();
}
const SCRIPT = `;(${ecosystem.toString()})();`;
Deno.serve((req)=>{
  const headers = {
    "content-type": "application/javascript; charset=utf-8",
    "cache-control": "no-store, no-cache, must-revalidate",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,HEAD,OPTIONS",
    "cross-origin-resource-policy": "cross-origin",
    "x-content-type-options": "nosniff",
    "x-samabusiness-version": VERSION
  };
  if (req.method === "OPTIONS") return new Response(null, {
    status: 204,
    headers
  });
  if (req.method !== "GET" && req.method !== "HEAD") return new Response("Method Not Allowed", {
    status: 405,
    headers
  });
  return new Response(req.method === "HEAD" ? null : SCRIPT, {
    headers
  });
});
