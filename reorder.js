const fs = require('fs');
let content = fs.readFileSync('/home/pc/dev/EgbayWeb/app/page.tsx', 'utf8');

// The main wrapper is:
// <div className="w-full max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-8 space-y-5 sm:space-y-7 pb-28 sm:pb-16 overflow-hidden">

const catStart = '      {/* ─── Category Discovery Squircle Rail (eBay Evo Pattern) ─── */}';
const heroStart = '      {/* ─── Hero Deal Banner with Dynamic Carousel ─── */}';
const trustStart = '      {/* ─── Micro-Trust Ticker ─── */}';
const tagsStart = '      {/* ─── Trending Tags & Condition Filter Bar ─── */}';

const p1 = content.indexOf(catStart);
const p2 = content.indexOf(heroStart);
const p3 = content.indexOf(trustStart);
const p4 = content.indexOf(tagsStart);

if (p1 > -1 && p2 > -1 && p3 > -1 && p4 > -1) {
  const catBlock = content.substring(p1, p2);
  const heroBlock = content.substring(p2, p3);
  const trustBlock = content.substring(p3, p4);
  
  const beforeCat = content.substring(0, p1);
  const afterTrust = content.substring(p4);
  
  const newTrendingBlock = `
      {/* ─── Trending Now (Horizontal Scroll) ─── */}
      <div className="pt-2 border-t border-slate-200/50">
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-1.5">
            <TrendingUp className="w-5 h-5 text-rose-500" />
            <h2 className="text-base font-black text-slate-900">{isRTL ? 'عروض رائجة الآن' : 'Trending Now'}</h2>
          </div>
          <button onClick={() => router.push('/?search=trending')} className="text-xs font-bold text-blue-600 hover:text-blue-800">
            {isRTL ? 'عرض الكل' : 'See All'}
          </button>
        </div>
        
        {loading ? (
          <div className="flex gap-4 overflow-x-auto no-scrollbar pb-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="w-[160px] sm:w-[180px] flex-shrink-0">
                <SkeletonCard />
              </div>
            ))}
          </div>
        ) : products.length > 0 ? (
          <div className="flex gap-3 sm:gap-4 overflow-x-auto no-scrollbar pb-4 snap-x">
            {products.slice(0, 8).map(product => (
              <div key={product.id} className="w-[150px] sm:w-[180px] flex-shrink-0 snap-start">
                <ProductCard product={product} onWishlistToggle={handleWishlistToggle} />
              </div>
            ))}
          </div>
        ) : null}
      </div>\n\n`;
  
  // New Order: beforeCat + heroBlock + trustBlock + catBlock + newTrendingBlock + afterTrust
  const newContent = beforeCat + heroBlock + trustBlock + catBlock + newTrendingBlock + afterTrust;
  
  fs.writeFileSync('/home/pc/dev/EgbayWeb/app/page.tsx', newContent);
  console.log('Successfully reordered blocks and added Trending section.');
} else {
  console.log('Could not find all blocks.');
}
