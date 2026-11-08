// دليل معالم 6 أكتوبر والشيخ زايد. الإحداثيات المؤكدة بس هي اللي فيها lat/lon (من مصادر مذكورة)؛ الباقي محتاج كود موقع من خرائط جوجل (Plus Code) أو lat,lon
// وبيتضاف بنفس الطريقة. ممنوع تخمين إحداثيات: غلط 200م بيحط المعلم في مكان غلط جوه الخريطة.
import { parsePlace } from './olc.js';
export const DIRECTORY = [
  { id: 'd-hosary', name: 'مسجد الحصري', area: 'أكتوبر · الحي السابع', lat: 29.97256, lon: 30.94394, src: 'كود الموقع XWFV+2H (فُكّ في اللعبة)', note: 'ميدان الحصري' },
  { id: 'd-moe', name: 'مول مصر', area: 'أكتوبر · طريق الواحات', lat: 29.971702, lon: 31.017132, src: 'ويكيبيديا', note: 'سكي مصر، فوكس سينما' },
  { id: 'd-moa', name: 'مول العرب (ميدان جهينة)', area: 'أكتوبر / زايد · ميدان جهينة', lat: 30.00694, lon: 30.97475, src: 'Around Us', note: '' },
  { id: 'd-dreamland', name: 'دريم لاند / دريم بارك', area: 'أكتوبر · طريق الواحات', note: 'الأرض اتباعت لمشروع جديد (هايد بارك) — راجع المكان قبل ما تحط معلم' },
  { id: 'd-sumed', name: 'غرب سوميد وممشى جرين بارك', area: 'أكتوبر · الطريق السياحي', note: 'قدام نادي 6 أكتوبر، محور 26 يوليو' },
  { id: 'd-oct-univ', name: 'جامعة 6 أكتوبر', area: 'أكتوبر', note: '' },
  { id: 'd-motamayez', name: 'الحي المتميز (ميدان جهينة)', area: 'أكتوبر', note: 'بين طريق الواحات ووصلة دهشور' },
  { id: 'd-smart', name: 'القرية الذكية', area: 'طريق مصر إسكندرية الصحراوي', note: '' },
  { id: 'd-arkan', name: 'أركان بلازا', area: 'زايد · المحور المركزي/محور 26 يوليو', note: 'الحي الخامس، شارع البستان' },
  { id: 'd-galleria', name: 'جاليريا 40', area: 'زايد', note: '' },
  { id: 'd-americana', name: 'أمريكانا بلازا', area: 'زايد', note: '' },
  { id: 'd-hyperone', name: 'هايبر وان', area: 'زايد', note: '' },
  { id: 'd-zayed-central', name: 'زايد سنترال بارك', area: 'زايد', note: '' },
  { id: 'd-beverly', name: 'بيفرلي هيلز', area: 'زايد', note: '' },
];
const R = 6371000, rad = (d) => (d * Math.PI) / 180;
export const offsetFrom = (c, lat, lon) => ({ x: R * rad(lon - c.lon) * Math.cos(rad(c.lat)), z: -R * rad(lat - c.lat) });
export const insideMap = (c, half, lat, lon) => { const o = offsetFrom(c, lat, lon); return Math.abs(o.x) < half - 12 && Math.abs(o.z) < half - 12; };
export const fmtDist = (c, lat, lon) => { const o = offsetFrom(c, lat, lon), d = Math.hypot(o.x, o.z); return d < 1000 ? Math.round(d) + ' م' : (d / 1000).toFixed(1) + ' كم'; };
export { parsePlace };
