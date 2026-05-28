export type CourseLandingData = {
  slug: string;
  group: string;
  badge: string;
  h1: string;
  subtitle: string;
  price: string;
  priceNote: string;
  primaryCta: string;
  secondaryCta: string;
  heroBenefits: string[];
  whoIsItFor: string[];
  courseIncludes: string[];
  timelineSteps: string[];
  whyBuBuBenefits: string[];
  fearBlock: string;
  availabilityNotice: string;
  reviews: { name: string; place: string; text: string; rating: number }[];
  faq: [string, string][];
  seoTitle: string;
  seoDescription: string;
};

const timelineSteps = [
  "Vyplníte krátkou online přihlášku.",
  "Ozveme se a pošleme další postup.",
  "Začnete teorií a praktickými jízdami.",
  "Připravíme vás na závěrečnou zkoušku.",
  "U zkoušky už víte, co vás čeká.",
];

const whyBuBuBenefits = [
  "Bez stresu a zbytečného tlaku",
  "Lidský a trpělivý přístup",
  "Jasný průběh kurzu od přihlášky po zkoušku",
  "Praktická příprava na reálný provoz",
];

const reviews = [
  { name: "Vladislav", place: "Praha 8", text: "Kurz byl dobrý, nemusel jsem řešit žádné zbytečné problémy.", rating: 5 },
  { name: "Barbora", place: "Praha 8", text: "Prostředí bylo velmi přátelské a neměla jsem strach dělat chyby.", rating: 5 },
  { name: "Iva", place: "Praha 8", text: "Výcvik byl přizpůsobený mému tempu.", rating: 5 },
];

export const courses: CourseLandingData[] = [
  {
    slug: "ridicak-skupina-b",
    group: "B",
    badge: "Skupina B",
    h1: "Řidičák skupiny B bez stresu",
    subtitle: "Kurz pro osobní auto vedený klidně, srozumitelně a krok za krokem.",
    price: "24 900 Kč",
    priceNote: "Cena zahrnuje kompletní výcvik, teorii, studijní materiály a přípravu na závěrečnou zkoušku.",
    primaryCta: "Rezervovat místo",
    secondaryCta: "Jak kurz probíhá",
    heroBenefits: ["Klidný instruktor", "Reálný provoz", "Studentský portál", "Možnost splátek"],
    whoIsItFor: ["Chcete první řidičák na osobní auto.", "Máte respekt z provozu.", "Potřebujete auto do práce, školy nebo běžného života."],
    courseIncludes: ["Teoretická výuka", "Praktické jízdy v provozu", "Online studijní materiály", "Příprava na testy a zkoušku"],
    timelineSteps,
    whyBuBuBenefits,
    fearBlock: "Víme, že první jízdy mohou být stres. Proto začínáme klidem, vysvětlením a postupným budováním jistoty.",
    availabilityNotice: "Kurz skupiny B přijímáme průběžně podle kapacit jednotlivých poboček.",
    reviews,
    faq: [["Jak dlouho trvá kurz skupiny B?", "Nejčastěji několik týdnů podle kapacity a frekvence jízd."]],
    seoTitle: "Řidičák skupiny B | Autoškola BuBu Praha, Kladno, Statenice",
    seoDescription: "Získejte řidičák skupiny B bez stresu. Klidný výcvik, lidský přístup a příprava na reálný provoz.",
  },
  {
    slug: "ridicak-skupina-b-automat",
    group: "B automat",
    badge: "Automat",
    h1: "Řidičák na automat bez zbytečného stresu",
    subtitle: "Automat je praktická volba, když chcete mít víc prostoru na provoz.",
    price: "24 900 Kč",
    priceNote: "Kurz na automat je dostupný na pobočce Praha 8 - Střížkov.",
    primaryCta: "Rezervovat místo",
    secondaryCta: "Jak kurz probíhá",
    heroBenefits: ["Méně stresu ze spojky", "Vhodné do města", "Moderní auta", "Praha 8 - Střížkov"],
    whoIsItFor: ["Budete jezdit hlavně automatem.", "Chcete jednodušší začátek řízení.", "Dělá vám stres spojka nebo řazení."],
    courseIncludes: ["Výcvik na automatické převodovce", "Teorie a studijní materiály", "Praktické jízdy v provozu"],
    timelineSteps,
    whyBuBuBenefits,
    fearBlock: "Automat často pomůže studentům, kteří se bojí rozjezdů nebo koordinace pedálů.",
    availabilityNotice: "Kurz B na automat nabízíme na pobočce Praha 8 - Střížkov.",
    reviews,
    faq: [["Budu moct řídit manuál?", "Po zkoušce na automat můžete řídit auta s automatickou převodovkou."]],
    seoTitle: "Řidičák na automat | Autoškola BuBu Praha 8",
    seoDescription: "Řidičák na automat v Autoškole BuBu. Méně stresu, klidný přístup a výcvik na pobočce Praha 8.",
  },
  {
    slug: "ridicak-skupina-a",
    group: "A",
    badge: "Motorka A",
    h1: "Řidičák na motorku skupiny A",
    subtitle: "Výcvik na velkou motorku s důrazem na techniku, jistotu a respekt k provozu.",
    price: "od 24 900 Kč",
    priceNote: "Moto kurzy nabízíme v balíčcích Moto základ a Moto Jistota.",
    primaryCta: "Rezervovat místo",
    secondaryCta: "Jak kurz probíhá",
    heroBenefits: ["Technika ovládání", "Bezpečný provoz", "Moto balíčky"],
    whoIsItFor: ["Chcete neomezenou skupinu A.", "Chcete poctivě natrénovat techniku i provoz."],
    courseIncludes: ["Teorie pro motocykly", "Jízdy na cvičišti", "Jízdy v provozu", "Příprava na zkoušku"],
    timelineSteps,
    whyBuBuBenefits,
    fearBlock: "U motorky je respekt zdravý. Pracujeme s ním postupně a bezpečně.",
    availabilityNotice: "Nejbližší moto kurzy začínají od konce srpna / začátku září. Místo si můžete rezervovat už teď.",
    reviews,
    faq: [["Kdy začínají moto kurzy?", "Nejbližší moto kurzy plánujeme od konce srpna / začátku září."]],
    seoTitle: "Řidičák na motorku skupiny A | Autoškola BuBu",
    seoDescription: "Kurz na motorku skupiny A v Autoškole BuBu. Klidný výcvik, technika a bezpečný provoz.",
  },
  {
    slug: "ridicak-skupina-a2",
    group: "A2",
    badge: "Motorka A2",
    h1: "Řidičák na motorku skupiny A2",
    subtitle: "Kurz pro střední motorky vedený postupně a bezpečně.",
    price: "od 24 900 Kč",
    priceNote: "Cena se řídí zvoleným moto balíčkem.",
    primaryCta: "Rezervovat místo",
    secondaryCta: "Jak kurz probíhá",
    heroBenefits: ["Pro střední motorky", "Cvičiště i provoz", "Postupný výcvik"],
    whoIsItFor: ["Chcete skupinu A2.", "Přecházíte z menší motorky.", "Chcete získat jistotu před provozem."],
    courseIncludes: ["Teorie", "Cvičiště", "Praktické jízdy", "Nácvik zkouškových úloh"],
    timelineSteps,
    whyBuBuBenefits,
    fearBlock: "Nemusíte přijít jako hotový motorkář. Techniku se učíte postupně a bezpečně.",
    availabilityNotice: "Nejbližší moto kurzy začínají od konce srpna / začátku září. Odesláním objednávky se zařadíte do pořadníku.",
    reviews,
    faq: [["Kdy je nástup?", "Moto kurzy plánujeme od konce srpna / začátku září."]],
    seoTitle: "Řidičák skupiny A2 | Autoškola BuBu",
    seoDescription: "Kurz na motorku A2 v Autoškole BuBu. Technika, jistota a klidný výcvik bez stresu.",
  },
  {
    slug: "ridicak-skupina-a1",
    group: "A1",
    badge: "Motorka A1",
    h1: "Řidičák na motorku skupiny A1",
    subtitle: "Kurz A1 pomůže začít s motocyklem bezpečně a srozumitelně.",
    price: "od 24 900 Kč",
    priceNote: "Cena se řídí zvoleným moto balíčkem.",
    primaryCta: "Rezervovat místo",
    secondaryCta: "Jak kurz probíhá",
    heroBenefits: ["Pro lehčí motorky", "Základy techniky", "Klidný start"],
    whoIsItFor: ["Začínáte s motorkou.", "Chcete postupný výcvik.", "Potřebujete si osvojit ovládání i provoz."],
    courseIncludes: ["Teorie", "Ovládání motorky", "Jízdy v provozu", "Zkouškové úlohy"],
    timelineSteps,
    whyBuBuBenefits,
    fearBlock: "Začátky na motorce mohou působit nejistě. Proto první kroky vysvětlujeme klidně.",
    availabilityNotice: "Nejbližší moto kurzy začínají od konce srpna / začátku září. Odesláním objednávky se zařadíte do pořadníku.",
    reviews,
    faq: [["Je A1 vhodná pro začátečníka?", "Ano, kurz je stavěný pro postupné získání základů techniky i provozu."]],
    seoTitle: "Řidičák skupiny A1 | Autoškola BuBu",
    seoDescription: "Kurz na motorku A1 v Autoškole BuBu. Bezpečný start, klidný instruktor a příprava na zkoušku.",
  },
  {
    slug: "ridicak-skupina-am",
    group: "AM",
    badge: "Motorka AM",
    h1: "Řidičák skupiny AM bez stresu",
    subtitle: "Začátek na dvou kolech má být bezpečný, pochopitelný a klidný.",
    price: "od 24 900 Kč",
    priceNote: "Cena se řídí zvoleným moto balíčkem.",
    primaryCta: "Rezervovat místo",
    secondaryCta: "Jak kurz probíhá",
    heroBenefits: ["První moto zkušenost", "Bezpečný základ", "Postupné tempo"],
    whoIsItFor: ["Začínáte úplně od nuly.", "Chcete bezpečný úvod do provozu.", "Potřebujete klidné vedení."],
    courseIncludes: ["Základy pravidel", "Ovládání stroje", "Jízdy v provozu", "Příprava na zkoušku"],
    timelineSteps,
    whyBuBuBenefits,
    fearBlock: "U prvního řidičáku je nejistota normální. Vysvětlujeme jednoduše a bezpečně.",
    availabilityNotice: "Nejbližší moto kurzy začínají od konce srpna / začátku září. Odesláním objednávky se zařadíte do pořadníku.",
    reviews,
    faq: [["Je AM pro úplné začátečníky?", "Ano, počítáme s tím, že student nemusí mít žádnou předchozí zkušenost."]],
    seoTitle: "Řidičák skupiny AM | Autoškola BuBu",
    seoDescription: "Kurz AM v Autoškole BuBu. Bezpečný začátek, klidné vedení a příprava do provozu.",
  },
  {
    slug: "kondicni-jizdy",
    group: "Kondiční jízdy",
    badge: "Kondiční jízdy",
    h1: "Kondiční jízdy pro jistotu za volantem",
    subtitle: "Pokud jste dlouho neřídili, bojíte se Prahy, parkování nebo dálnice, pomůžeme vám vrátit jistotu.",
    price: "podle rozsahu",
    priceNote: "Rozsah jízd doporučíme podle toho, co potřebujete natrénovat.",
    primaryCta: "Rezervovat místo",
    secondaryCta: "Jak kurz probíhá",
    heroBenefits: ["Parkování", "Praha a provoz", "Dálnice", "Návrat po pauze"],
    whoIsItFor: ["Máte řidičák, ale necítíte se jistě.", "Dlouho jste neřídili.", "Bojíte se parkování, města nebo dálnice."],
    courseIncludes: ["Individuální domluva cíle", "Jízdy v reálném provozu", "Parkování", "Klidná zpětná vazba"],
    timelineSteps: ["Vyplníte krátkou poptávku.", "Domluvíme, co chcete trénovat.", "Vyrazíme na jízdy podle vašeho cíle.", "Přidáme náročnější situace.", "Odcházíte s větší jistotou."],
    whyBuBuBenefits,
    fearBlock: "Není ostuda říct, že se za volantem necítíte dobře. Kondiční jízdy jsou přesně od toho.",
    availabilityNotice: "Kondiční jízdy domlouváme individuálně podle možností studenta a instruktora.",
    reviews,
    faq: [["Co můžeme trénovat?", "Parkování, město, dálnici, kruhové objezdy nebo konkrétní trasu."]],
    seoTitle: "Kondiční jízdy Praha a Kladno | Autoškola BuBu",
    seoDescription: "Kondiční jízdy pro návrat jistoty za volantem. Parkování, Praha, dálnice i návrat po pauze.",
  },
];
