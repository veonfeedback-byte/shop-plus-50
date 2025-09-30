// app/page.tsx
"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useLayoutEffect,
} from "react";
import Link from "next/link";
import Head from "next/head";
import Fuse from "fuse.js";
import Catalog, { Product } from "./lib/catalog";
import { HomeContext } from "./lib/HomeContext";
import { ArrowLeft, Search, Truck, Tag, ShoppingBag, Flame, CreditCard } from "lucide-react";

/* ----------------- types ----------------- */
type IndexedProduct = Product & {
  categorySlug: string;
  subcategorySlug: string;
  mainImage?: string | null;
};

/* ----------------- utils ----------------- */
function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}

// Cache categories globally
const cachedCategories = Catalog.getCategories();

/* ---------- Small memoized product card with tags + modern price ---------- */
function ProductCard({
  p,
  href,
  onClick,
  eager,
}: {
  p: IndexedProduct;
  href: string;
  onClick?: () => void;
  eager?: boolean;
}) {
  const [loaded, setLoaded] = useState(false);

  const tags = ["20% OFF", "30% OFF", "Hot", "Sale", "Popular", null, null];
  const tag = useMemo(() => {
    const index = (p.id.charCodeAt(0) + p.id.length) % tags.length;
    return tags[index];
  }, [p.id]);

  const discountMatch = tag && /\d+/.test(tag) ? parseInt(tag.match(/\d+/)![0]) : null;
  const inflated = discountMatch
    ? Math.round(Number(p.price) * (1 + discountMatch / 100))
    : null;

  return (
    <Link
      href={href}
      onClick={() => {
        try {
          sessionStorage.setItem("homeScrollY", String(window.scrollY));
          sessionStorage.setItem("visibleHome", String(visibleHome));
        } catch {}
        if (onClick) onClick();
      }}
      className="group block bg-white rounded-2xl overflow-hidden shadow-md hover:shadow-lg transition-all duration-300"
    >
      {/* Image */}
      <div className="relative w-full aspect-square bg-gray-100 overflow-hidden">
        {p.mainImage ? (
          <img
            src={p.mainImage}
            alt={p.title}
            className={`w-full h-full object-contain p-2 transition-transform duration-500 group-hover:scale-105 ${
              loaded ? "opacity-100" : "opacity-0"
            }`}
            loading={eager ? "eager" : "lazy"}
            onLoad={() => setLoaded(true)}
          />
        ) : (
          <div className="w-full h-full bg-gray-200 animate-pulse" />
        )}

        {tag && (
          <span className="absolute top-2 left-2 bg-red-600 text-white text-[11px] font-semibold px-2 py-0.5 rounded-full shadow-sm">
            {tag}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="px-3 py-2">
        <h3 className="text-sm font-medium text-gray-800 line-clamp-2 group-hover:text-indigo-600 transition-colors">
          {p.title}
        </h3>

        <div className="mt-1 flex items-center gap-2">
          {discountMatch ? (
            <>
              <span className="text-xs text-gray-400 line-through">
                Rs {inflated}
              </span>
              <span className="text-base font-bold text-gray-900">
                Rs {p.price}
              </span>
            </>
          ) : (
            <span className="text-base font-bold text-gray-900">
              Rs {p.price}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

/* ---------- main component ---------- */
export default function HomePage() {
  const [query, setQuery] = useState("");
  const [showBackButton, setShowBackButton] = useState(false);


  /* ---------- Build product index once ---------- */
  const allProducts = useMemo<IndexedProduct[]>(() => {
    const out: IndexedProduct[] = [];
    for (const cat of cachedCategories) {
      for (const sub of cat.subcategories) {
        for (const p of sub.products || []) {
          const mainImage =
            p.img ?? (Array.isArray((p as any).images) ? (p as any).images[0] : null);
          if (!mainImage) continue;
          const priceNum = Number(p.price) || 0;
          if (priceNum <= 0) continue;
          out.push({
            ...(p as IndexedProduct),
            categorySlug: cat.slug,
            subcategorySlug: sub.slug,
            mainImage,
          });
        }
      }
    }
    return out;
  }, []);

   /* ---------- Initial home picks ---------- */
  const initialHomePicks = useMemo(() => {
    const picks: IndexedProduct[] = [];
    for (const cat of cachedCategories) {
      for (const sub of cat.subcategories) {
        const valid = allProducts.filter(
          (p) => p.categorySlug === cat.slug && p.subcategorySlug === sub.slug
        );
        if (valid.length) {
          picks.push(valid[0]); // always pick first → stable across SSR/CSR
        }
      }
    }
    return picks;
  }, [allProducts]);


  const [homeProducts, setHomeProducts] = useState<IndexedProduct[]>(initialHomePicks);

  const [visibleHome, setVisibleHome] = useState<number>(20);
  const [visibleSearch, setVisibleSearch] = useState<number>(10);

  const inputRef = useRef<HTMLInputElement | null>(null);

  const [priceSort, setPriceSort] = useState<"asc" | "desc" | null>(null);
  const [searchTriggered, setSearchTriggered] = useState(false);

  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeSubcategory, setActiveSubcategory] = useState<string | null>(null);
  const [searchFocused, setSearchFocused] = useState(false);

  const [bestSuggestion, setBestSuggestion] = useState<string | null>(null);
  const MAX_HOME = allProducts.length; // allow loading all

  useEffect(() => {
    const hydrate = () => {
      if (typeof window === "undefined") return;
      const cached = sessionStorage.getItem("homeProducts");
      if (cached) {
        try {
          setHomeProducts(JSON.parse(cached));
          return;
        } catch {}
      }
      const shuffled = shuffle(initialHomePicks);
      setHomeProducts(shuffled);
      try {
        sessionStorage.setItem("homeProducts", JSON.stringify(shuffled));
      } catch {}
    };

    if ("requestIdleCallback" in window) {
      (window as any).requestIdleCallback(hydrate, { timeout: 200 });
    } else {
      const t = setTimeout(hydrate, 100);
      return () => clearTimeout(t);
    }
  }, [initialHomePicks]);

  /* ---------- Fuse search ---------- */
  const [fuse, setFuse] = useState<Fuse<IndexedProduct> | null>(null);
  useEffect(() => {
    const build = () => {
      try {
        const f = new Fuse(allProducts, {
          keys: ["title"],
          threshold: 0.6,            // allow looser matching (catch typos)
          distance: 200,             // allow matches far apart
          ignoreLocation: true,
          minMatchCharLength: 2,     // avoid noise for 1-char
        });

        setFuse(f);
      } catch {
        setFuse(null);
      }
    };

    if ("requestIdleCallback" in window) {
      (window as any).requestIdleCallback(build, { timeout: 800 });
    } else {
      const t = setTimeout(build, 300);
      return () => clearTimeout(t);
    }
  }, [allProducts]);

  /* ---------- Debounced query ---------- */
  const [debouncedQuery, setDebouncedQuery] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim().toLowerCase()), 60);
    return () => clearTimeout(t);
  }, [query]);

  /* ---------- Category & Subcategory suggestions ---------- */
  const categorySuggestions = useMemo(() => {
    if (!debouncedQuery || searchTriggered) return [];
    const cats: {
      type: "category" | "subcategory";
      slug: string;
      title: string;
      parent?: string;
    }[] = [];
    const q = debouncedQuery;
    for (const cat of cachedCategories) {
      if (cat.name.toLowerCase().includes(q)) {
        cats.push({ type: "category", slug: cat.slug, title: cat.name });
      }
      for (const sub of cat.subcategories) {
        if (sub.name.toLowerCase().includes(q)) {
          cats.push({
            type: "subcategory",
            slug: sub.slug,
            title: sub.name,
            parent: cat.slug,
          });
        }
      }
    }
    return cats.slice(0, 6);
  }, [debouncedQuery, searchTriggered]);

  /* ---------- Search results ---------- */
  const searchResults = useMemo<IndexedProduct[]>(() => {
  if (!debouncedQuery || !searchTriggered) {
    setBestSuggestion(null);
    return [];
  }

  const q = debouncedQuery.trim().toLowerCase();

  // ✅ Detect numbers in query for price search
  const priceMatch = q.match(/(\d+)/);
  if (priceMatch) {
    const priceVal = Number(priceMatch[1]);
    const res = allProducts.filter((p) => Number(p.price) <= priceVal);
    setBestSuggestion(null);
    return res;
  }

  if (!fuse) {
    setBestSuggestion(null);
    return [];
  }

  // 🔍 Get results WITH scores
  const fuseResults = fuse.search(q, { limit: 300 });

  // ✅ Pick best suggestion (closest match)
  if (fuseResults.length > 0) {
    const best = fuseResults[0];
    if (best.score !== undefined && best.score < 0.4) {
      setBestSuggestion(best.item.title);
    } else {
      setBestSuggestion(null);
    }
  } else {
    setBestSuggestion(null);
  }

  let fuzzy = fuseResults.map((r) => r.item);

  // ✅ Fallback partial word match
  if (fuzzy.length === 0) {
    const words = q.split(/\s+/).filter(Boolean);
    fuzzy = allProducts.filter((p) =>
      words.some((w) => p.title.toLowerCase().includes(w))
    );
  }

  // ✅ Fallback trending products
  if (fuzzy.length === 0) {
    fuzzy = homeProducts.slice(0, 10);
  }

  // ✅ Dedup + sort
  const deduped = Array.from(
    new Map(fuzzy.map((m) => [`${m.categorySlug}-${m.subcategorySlug}-${m.id}`, m])).values()
  );

  if (priceSort) {
    deduped.sort((a, b) => {
      const pa = Number(a.price) || 0;
      const pb = Number(b.price) || 0;
      return priceSort === "asc" ? pa - pb : pb - pa;
    });
  }

  return deduped;
}, [debouncedQuery, searchTriggered, fuse, allProducts, priceSort, homeProducts]);

  /* ---------- Final results ---------- */
  const finalResults = useMemo<IndexedProduct[]>(() => {
    if (activeCategory || activeSubcategory) {
      let filtered = allProducts.filter(
        (p) =>
          (!activeCategory || p.categorySlug === activeCategory) &&
          (!activeSubcategory || p.subcategorySlug === activeSubcategory)
      );
      if (priceSort) {
        filtered.sort((a, b) => {
          const pa = Number(a.price) || 0;
          const pb = Number(b.price) || 0;
          return priceSort === "asc" ? pa - pb : pb - pa;
        });
      }
      return filtered;
    }
    return searchResults;
  }, [activeCategory, activeSubcategory, allProducts, searchResults, priceSort]);

  /* ---------- Reset Home ---------- */
  const resetHome = useCallback(() => {
    setQuery("");
    setShowBackButton(false);
    setPriceSort(null);
    setVisibleSearch(10);
    setSearchTriggered(false);
    setActiveCategory(null);
    setActiveSubcategory(null);
    try {
      sessionStorage.clear();
    } catch {}
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  /* ---------- product url ---------- */
  const productUrl = useCallback(
    (p: IndexedProduct) =>
      `/shop/${encodeURIComponent(p.categorySlug)}/${encodeURIComponent(
        p.subcategorySlug
      )}/${encodeURIComponent(p.id)}`,
    []
  );

  /* ---------- Restore state ---------- */
  useEffect(() => {
    const lastQ = sessionStorage.getItem("lastQuery");
    const lastScroll = sessionStorage.getItem("scrollY");
    const lastVisible = sessionStorage.getItem("visibleSearch");
    const lastCat = sessionStorage.getItem("lastCategory");
    const lastSub = sessionStorage.getItem("lastSubcategory");
    const lastSort = sessionStorage.getItem("lastSort");
    // ✅ Restore home-specific state
    const lastHomeScroll = sessionStorage.getItem("homeScrollY");
    const lastHomeVisible = sessionStorage.getItem("visibleHome");

    if (lastQ) {
      setQuery(lastQ);
      setShowBackButton(true);
      setSearchTriggered(true);
    }
    if (lastVisible) setVisibleSearch(Number(lastVisible));
    if (lastScroll) (window as any).__restoreScrollY = Number(lastScroll);
    if (lastCat) setActiveCategory(lastCat);
    if (lastSub) setActiveSubcategory(lastSub);
    if (lastSort) setPriceSort(lastSort as "asc" | "desc");
    if (!lastQ && lastHomeVisible) setVisibleHome(Number(lastHomeVisible));
    if (!lastQ && lastHomeScroll) (window as any).__restoreHomeScrollY = Number(lastHomeScroll);

  }, []);

  useLayoutEffect(() => {
    if ((window as any).__restoreScrollY != null && finalResults.length > 0) {
      const y = (window as any).__restoreScrollY;
      delete (window as any).__restoreScrollY;
      setTimeout(() => {
        window.scrollTo({ top: y, behavior: "instant" as ScrollBehavior });
      }, 0);
    }
  }, [finalResults, visibleSearch]);

   // ✅ Restore scroll for Home products
  useLayoutEffect(() => {
    if ((window as any).__restoreHomeScrollY != null && homeProducts.length > 0) {
      const y = (window as any).__restoreHomeScrollY;
      delete (window as any).__restoreHomeScrollY;
      setTimeout(() => {
        window.scrollTo({ top: y, behavior: "instant" as ScrollBehavior });
      }, 0);
    }
  }, [homeProducts, visibleHome]);

  // ✅ Restore scroll only when the right number of products are visible
  useLayoutEffect(() => {
    const savedY = (window as any).__restoreHomeScrollY;
    const savedVisible = Number(sessionStorage.getItem("visibleHome") || 0);
  
    if (savedY != null && visibleHome >= savedVisible && homeProducts.length > 0) {
      delete (window as any).__restoreHomeScrollY;
      setTimeout(() => {
        window.scrollTo({ top: savedY, behavior: "instant" as ScrollBehavior });
      }, 0);
    }
  }, [homeProducts, visibleHome]);

  useEffect(() => {
    function onScroll() {
      if (
        window.innerHeight + window.scrollY >= document.body.offsetHeight - 200 &&
        visibleHome < MAX_HOME
      ) {
        setVisibleHome((v) => Math.min(v + 20, MAX_HOME));
      }
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [visibleHome, MAX_HOME]);

  // ✅ Save visibleHome immediately when it changes
  useEffect(() => {
    try {
      sessionStorage.setItem("visibleHome", String(visibleHome));
    } catch {}
  }, [visibleHome]);

    // ✅ Save scroll & visibleHome for Home products
  useEffect(() => {
    const saveState = () => {
      try {
        sessionStorage.setItem("homeScrollY", String(window.scrollY));
        sessionStorage.setItem("visibleHome", String(visibleHome));
      } catch {}
    };
    window.addEventListener("beforeunload", saveState);
    window.addEventListener("pagehide", saveState);
    return () => {
      window.removeEventListener("beforeunload", saveState);
      window.removeEventListener("pagehide", saveState);
    };
  }, [visibleHome]);

  
    const [currentSlide, setCurrentSlide] = useState(1); // start at first "real" slide
    const [isTransitioning, setIsTransitioning] = useState(true);
    
    const sliderItems = [
      { text: "Free delivery", highlight: "100,000+ products", icon: "truck" },
      { text: "Find goods at", highlight: "your price range", icon: "tag" },
      { text: "Just name it,", highlight: "get it on Trolly.pk", icon: "shopping-bag" },
      { text: "Daily hot deals", highlight: "& discounts", icon: "flame" },
      { text: "Cash on Delivery", highlight: "available nationwide", icon: "credit-card" },
    ];
    
    // Clone first & last
    const extendedSlides = [
      sliderItems[sliderItems.length - 1],
      ...sliderItems,
      sliderItems[0],
    ];
    
    useEffect(() => {
      let interval: NodeJS.Timeout | null = null;
    
      const start = () => {
        interval = setInterval(() => {
          setCurrentSlide((prev) => prev + 1);
          setIsTransitioning(true);
        }, 4000);
      };
    
      const stop = () => {
        if (interval) clearInterval(interval);
      };
    
      // run autoplay
      start();
    
      // stop autoplay when tab hidden
      const handleVisibility = () => {
        if (document.hidden) stop();
        else start();
      };
      document.addEventListener("visibilitychange", handleVisibility);
    
      return () => {
        stop();
        document.removeEventListener("visibilitychange", handleVisibility);
      };
    }, []);

    
    const handleTransitionEnd = () => {
      if (currentSlide === extendedSlides.length - 1) {
        setIsTransitioning(false);
        setCurrentSlide(1); // jump back to first real
      } else if (currentSlide === 0) {
        setIsTransitioning(false);
        setCurrentSlide(extendedSlides.length - 2); // jump to last real
      } else {
        setIsTransitioning(true);
      }
    };
  // swipe support
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);
  
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  
  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  };
  
  const handleTouchEnd = () => {
    const diff = touchStartX.current - touchEndX.current;
    if (Math.abs(diff) > 50) { // swipe threshold
      if (diff > 0) {
        setCurrentSlide((prev) => prev + 1); // swipe left → next
      } else {
        setCurrentSlide((prev) => prev - 1); // swipe right → prev
      }
      setIsTransitioning(true);
    }
  };

  /* ---------- Render ---------- */
  return (
    <HomeContext.Provider value={{ resetHome }}>
      <Head>
        <title>Trolly – Online Shopping in Pakistan | Best Prices 2025</title>
        <meta
          name="description"
          content="Trolly is your trusted online shopping store in Pakistan. Explore trending fashion, electronics, home products & more at affordable prices."
        />
        <meta
          name="keywords"
          content="Trolly, online shopping Pakistan, buy products online, best prices Pakistan, fashion, electronics"
        />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href="https://trollypk.vercel.app/" />

        {/* Open Graph */}
        <meta property="og:type" content="website" />
        <meta property="og:title" content="Trolly – Online Shopping in Pakistan" />
        <meta
          property="og:description"
          content="Buy latest fashion, electronics & more at Trolly.pk with best prices and fast delivery."
        />
        <meta property="og:url" content="https://trollypk.vercel.app/" />
        <meta property="og:image" content="/assets/Logo.png" />

        {/* Schema.org */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: "Trolly",
              url: "https://trollypk.vercel.app",
              logo: "https://trollypk.vercel.app/assets/Logo.png",
              sameAs: ["https://facebook.com", "https://instagram.com", "https://twitter.com"],
            }),
          }}
        />
      </Head>

      <div className="pb-28 pt-[50px]">
        {/* Search Row (modern style) */}
        <div className="fixed top-[56px] left-0 right-0 z-30 bg-white py-3 px-3 shadow-sm border-b border-gray-200">
          <div className="w-full px-0 md:px-3 flex items-center gap-3 overflow-visible">
            {showBackButton && (
              <button
                onClick={resetHome}
                aria-label="Back"
                className="flex items-center justify-center p-2 text-gray-700 hover:text-black transition"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}

            <div className="relative flex-1">
              <div
                className={
                  "flex items-center w-full rounded-[12px] px-4 py-2 transition-shadow transition-colors " +
                  (searchFocused
                    ? "shadow-lg border-2 border-blue-400 bg-white"
                    : "shadow-sm border border-gray-200 bg-white/95")
                }
              >
                <Search className={`w-5 h-5 mr-3 ${searchFocused ? "text-blue-500" : "text-gray-400"}`} />

                <input
                  ref={inputRef}
                  type="search"
                  inputMode="search"
                  enterKeyHint="search"
                  placeholder="Search by name or price (e.g. Rs 300, Shoes)"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setSearchTriggered(false);
                  }}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setSearchFocused(false)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      inputRef.current?.blur();

                      // immediately apply query to debouncedQuery so Enter is instant
                      const normalized = query.trim().toLowerCase();
                      setDebouncedQuery(normalized);

                      // reset some search state and trigger
                      setActiveCategory(null);
                      setActiveSubcategory(null);
                      setPriceSort(null);
                      setVisibleSearch(10);

                      setSearchTriggered(true);
                      setShowBackButton(true);

                      try {
                        sessionStorage.setItem("lastQuery", query);
                        sessionStorage.removeItem("lastCategory");
                        sessionStorage.removeItem("lastSubcategory");
                        sessionStorage.removeItem("lastSort");
                        sessionStorage.setItem("visibleSearch", "10");
                      } catch {}
                    }
                  }}
                  className="flex-1 bg-transparent outline-none text-gray-800 placeholder-gray-500"
                />
              </div>
          
              {/* suggestions dropdown (keeps your existing logic but styled) */}
              {categorySuggestions.length > 0 && (
                <div className="absolute z-40 mt-2 w-full bg-white rounded-xl shadow-lg max-h-60 overflow-auto border border-gray-100">
                  {categorySuggestions.map((s) => (
                    <button
                      key={`${s.type}-${s.parent || "root"}-${s.slug}`}
                      onClick={() => {
                        if (s.type === "category") {
                          setActiveCategory(s.slug);
                          setActiveSubcategory(null);
                          try {
                            sessionStorage.setItem("lastCategory", s.slug);
                            sessionStorage.removeItem("lastSubcategory");
                          } catch {}
                        } else {
                          setActiveCategory(s.parent || null);
                          setActiveSubcategory(s.slug);
                          try {
                            sessionStorage.setItem("lastCategory", s.parent || "");
                            sessionStorage.setItem("lastSubcategory", s.slug);
                          } catch {}
                        }
                        setSearchTriggered(true);
                        setShowBackButton(true);
                        setQuery(s.title);
                        try {
                          sessionStorage.setItem("lastQuery", s.title);
                        } catch {}
                      }}
                      className="block w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-600"
                    >
                      {s.title}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* SLIDER */}
        {!searchTriggered && (
          <div className="relative overflow-hidden w-screen -ml-[calc((100vw-100%)/2)]">
            <div className="overflow-hidden w-full">
              <div
                className={`flex ${isTransitioning ? "transition-transform duration-700 ease-in-out" : ""}`}
                style={{
                  transform: `translateX(-${Math.min(
                    Math.max(currentSlide, 0),
                    extendedSlides.length - 1
                  ) * 100}%)`,
                }}
                onTransitionEnd={handleTransitionEnd}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
              >
                {extendedSlides.map((item, idx) => {
                  let realIndex: number;
                  if (idx === 0) realIndex = sliderItems.length - 1;
                  else if (idx === extendedSlides.length - 1) realIndex = 0;
                  else realIndex = idx - 1;
        
                  return (
                    <div
                      key={idx}
                      className={`flex-shrink-0 w-full h-[120px] sm:h-[140px] md:h-[160px] flex items-center justify-center
                        ${realIndex === 0 ? "bg-gradient-to-r from-amber-200 via-rose-200 to-orange-100" : ""}
                        ${realIndex === 1 ? "bg-gradient-to-r from-yellow-200 via-amber-200 to-orange-100" : ""}
                        ${realIndex === 2 ? "bg-gradient-to-r from-purple-200 via-indigo-200 to-pink-200" : ""}
                        ${realIndex === 3 ? "bg-gradient-to-r from-rose-200 via-red-200 to-pink-100" : ""}
                        ${realIndex === 4 ? "bg-gradient-to-r from-emerald-200 via-green-200 to-teal-100" : ""}
                      `}
                    >
                      {/* ICON + TEXT */}
                      <div className="flex items-center gap-4">
                        {item.icon === "truck" && <Truck className="w-12 h-12 text-rose-600 drop-shadow-md" />}
                        {item.icon === "tag" && <Tag className="w-12 h-12 text-amber-600 drop-shadow-md" />}
                        {item.icon === "shopping-bag" && <ShoppingBag className="w-12 h-12 text-indigo-600 drop-shadow-md" />}
                        {item.icon === "flame" && <Flame className="w-12 h-12 text-red-600 drop-shadow-md" />}
                        {item.icon === "credit-card" && <CreditCard className="w-12 h-12 text-green-600 drop-shadow-md" />}
        
                        <div className="flex flex-col">
                          <span className="text-lg sm:text-xl font-extrabold text-gray-800">{item.text}</span>
                          <span className="mt-2 inline-block px-3 py-1 rounded-md text-sm font-semibold text-gray-100
                            bg-gradient-to-r from-gray-800 via-gray-900 to-black shadow">
                            {item.highlight}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
        
            {/* DOTS */}
            <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-2">
              {sliderItems.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentSlide(i + 1)}
                  className={`h-1.5 w-1.5 rounded-full transition ${
                    currentSlide === i + 1 ? "bg-black scale-125" : "bg-gray-300"
                  }`}
                />
              ))}
            </div>
          </div>
        )}


        {/* Search results */}
        {searchTriggered && (debouncedQuery || activeCategory || activeSubcategory) ? (
          <>
            {/* sort buttons */}
            <div className="flex items-center gap-3 mb-4 mt-4">
              <button
                onClick={() => {
                  setPriceSort("asc");
                  try {
                    sessionStorage.setItem("lastSort", "asc");
                  } catch {}
                }}
                className={`px-4 py-2 rounded-lg border text-sm ${
                  priceSort === "asc" ? "bg-indigo-600 text-white" : "bg-white text-gray-700"
                }`}
              >
                Price ↑
              </button>
              <button
                onClick={() => {
                  setPriceSort("desc");
                  try {
                    sessionStorage.setItem("lastSort", "desc");
                  } catch {}
                }}
                className={`px-4 py-2 rounded-lg border text-sm ${
                  priceSort === "desc" ? "bg-indigo-600 text-white" : "bg-white text-gray-700"
                }`}
              >
                Price ↓
              </button>
              {priceSort && (
                <button
                  onClick={() => {
                    setPriceSort(null);
                    try {
                      sessionStorage.removeItem("lastSort");
                    } catch {}
                  }}
                  className="px-4 py-2 rounded-lg border text-sm bg-white text-gray-500"
                >
                  Reset
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
             {finalResults.length === 0 ? (
                <p className="col-span-full text-center text-gray-500 py-8 text-lg font-medium">
                  No products found
                </p>
              ) : (
                <>
                  {bestSuggestion && bestSuggestion.toLowerCase() !== debouncedQuery && (
                    <p className="col-span-full text-center text-gray-400 text-sm mb-2">
                      Did you mean:{" "}
                      <button
                        onClick={() => {
                          setQuery(bestSuggestion);
                          setDebouncedQuery(bestSuggestion.toLowerCase());
                          setSearchTriggered(true);
                        }}
                        className="font-semibold text-indigo-600 hover:underline"
                      >
                        {bestSuggestion}
                      </button>
                      ?
                    </p>
                  )}
                  {finalResults.slice(0, visibleSearch).map((p, idx) => (
                    <ProductCard
                      key={`${p.categorySlug}-${p.subcategorySlug}-${p.id}`}
                      p={p}
                      href={productUrl(p)}
                      onClick={() => {
                        try {
                          sessionStorage.setItem("scrollY", String(window.scrollY));
                          sessionStorage.setItem("lastQuery", query);
                          sessionStorage.setItem("visibleSearch", String(visibleSearch));
                          if (activeCategory) sessionStorage.setItem("lastCategory", activeCategory);
                          if (activeSubcategory) sessionStorage.setItem("lastSubcategory", activeSubcategory);
                          if (priceSort) sessionStorage.setItem("lastSort", priceSort);
                        } catch {}
                      }}
                      eager={idx < 4}
                    />
                  ))}
                </>
              )}
            </div>

            {visibleSearch < finalResults.length && (
              <div className="flex justify-center mt-6">
                <button
                  onClick={() => {
                    const next = visibleSearch + 20;
                    setVisibleSearch(next);
                    try {
                      sessionStorage.setItem("visibleSearch", String(next));
                    } catch {}
                  }}
                  className="px-6 py-3 rounded-xl bg-indigo-600 text-white shadow hover:bg-indigo-700 transition"
                >
                  Load more
                </button>
              </div>
            )}
          </>
            ) : (
            <section>
           
            {/* Trending Header */}
            <div className="flex items-center gap-2 mt-6 w-fit px-5 py-2 rounded-2xl shadow-md
                            bg-gradient-to-r from-gray-50 via-gray-100 to-gray-200
                            border border-gray-300">
              <Flame className="w-6 h-6 text-red-500 drop-shadow-sm" />
              <span className="text-lg sm:text-xl font-extrabold tracking-wide text-gray-800 
                               [text-shadow:_1px_1px_2px_rgb(0_0_0_/_15%)]">
                Trending
              </span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 mt-4">
              {homeProducts.slice(0, visibleHome).map((p, idx) => (
                <ProductCard
                  key={`${p.categorySlug}-${p.subcategorySlug}-${p.id}`}
                  p={p}
                  href={productUrl(p)}
                  onClick={() => {
                    try {
                      sessionStorage.setItem("scrollY", String(window.scrollY));
                    } catch {}
                  }}
                  eager={idx < 4}
                />
              ))}
            </div>

            {visibleHome >= 20 && visibleHome < homeProducts.length && (
              <div className="flex justify-center mt-6">
                <button
                  onClick={() => setVisibleHome((v) => v + 20)}
                  className="px-6 py-3 rounded-xl bg-indigo-600 text-white shadow hover:bg-indigo-700 transition"
                >
                  Load more
                </button>
              </div>
            )}
          </section>
        )}
      </div>
    </HomeContext.Provider>
  );
}
