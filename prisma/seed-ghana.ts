// prisma/seed-ghana.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding Ghana location data...");

  // 1. Create Ghana
  const ghana = await prisma.country.upsert({
    where: { code: "GH" },
    update: {},
    create: {
      name: "Ghana",
      code: "GH",
      isActive: true,
    },
  });

  console.log(`✅ Created country: ${ghana.name}`);

  // 2. Ghana's 16 Regions with their districts
  const regionsData = [
    {
      name: "Greater Accra",
      code: "GA",
      districts: [
        { name: "Accra Metropolitan", code: "GA-AMA", localities: ["Osu", "Cantonments", "Airport Residential", "East Legon", "Adabraka", "James Town", "Labadi", "Teshie", "Nungua", "Tema"] },
        { name: "Tema Metropolitan", code: "GA-TMA", localities: ["Tema Community 1", "Tema Community 2", "Tema Community 3", "Tema Community 4", "Tema Community 5", "Tema Community 18", "Tema Community 25"] },
        { name: "Ga East Municipal", code: "GA-GEM", localities: ["Abeka", "Ofankor", "Amasaman", "Obuasi", "Baatsona"] },
        { name: "Ga West Municipal", code: "GA-GWM", localities: ["Weija", "Amasaman", "Sowutuom", "Prampram"] },
        { name: "Ga Central Municipal", code: "GA-GCM", localities: ["Weija", "Ngleshi", "Amanfrom"] },
        { name: "Ga South Municipal", code: "GA-GSM", localities: ["Weija", "Ngleshi", "Amasaman", "Kwabenya"] },
        { name: "Ga North Municipal", code: "GA-GNM", localities: ["McCarthy Hill", "Oyibi", "Pokuase"] },
        { name: "Ledzokuku Municipal", code: "GA-LMA", localities: ["Teshie", "Nungua", "Tema New Town"] },
        { name: "La Dade Kotopon Municipal", code: "GA-LDK", localities: ["Labadi", "Cantonments", "Dade Kotopon"] },
        { name: "La Nkwantanang Madina Municipal", code: "GA-LNM", localities: ["Madina", "Adenta", "Haatso"] },
        { name: "Ashaiman Municipal", code: "GA-ASH", localities: ["Ashaiman", "Tema Station"] },
        { name: "Adentan Municipal", code: "GA-ADM", localities: ["Adenta", "Madina", "Appolonia"] },
        { name: "Shai Osudoku District", code: "GA-SOD", localities: ["Dodowa", "Shai Hills"] },
        { name: "Kpone Katamanso District", code: "GA-KKD", localities: ["Kpone", "Katamanso"] },
      ],
    },
    {
      name: "Ashanti",
      code: "AR",
      districts: [
        { name: "Kumasi Metropolitan", code: "AR-KMA", localities: ["Adum", "Bantama", "Asokwa", "Suame", "Kwadaso", "Tafo", "Ayigya", "Ahodwo", "Santasi", "Kejetia", "Manhyia"] },
        { name: "Bosomtwe District", code: "AR-BOD", localities: ["Kuntanase", "Begoro"] },
        { name: "Ejisu Municipal", code: "AR-EJM", localities: ["Ejisu", "Bomso"] },
        { name: "Juaben Municipal", code: "AR-JUM", localities: ["Juaben", "Asamang"] },
        { name: "Mampong Municipal", code: "AR-MAM", localities: ["Mampong", "Anwia"] },
        { name: "Obuasi Municipal", code: "AR-OBM", localities: ["Obuasi", "Adansi"] },
        { name: "Sekyere Central District", code: "AR-SCD", localities: ["Agona", "Effiduase"] },
        { name: "Atwima Nwabiagya North", code: "AR-ANN", localities: ["Barekese", "Mamponteng"] },
        { name: "Atwima Nwabiagya South", code: "AR-ANS", localities: ["Kuntanase", "Ntobo"] },
        { name: "Atwima Kwanwoma", code: "AR-AKW", localities: ["Bekwai", "Nsuar"] },
      ],
    },
    {
      name: "Western",
      code: "WR",
      districts: [
        { name: "Takoradi Metropolitan", code: "WR-TMA", localities: ["Takoradi", "Achimota", "Ntankoful", "Kwesimintsim"] },
        { name: "Shama District", code: "WR-SHD", localities: ["Shama", "Batabie"] },
        { name: "Ellembelle District", code: "WR-ELE", localities: ["Axim", "Beyin"] },
        { name: "Jomoro Municipal", code: "WR-JOM", localities: ["Bogoso", "Prestea"] },
        { name: "Nzema East Municipal", code: "WR-NEM", localities: ["Beyin", "Ankobra"] },
      ],
    },
    {
      name: "Central",
      code: "CR",
      districts: [
        { name: "Cape Coast Metropolitan", code: "CR-CCM", localities: ["Cape Coast", "Kotokuraba", "Abura"] },
        { name: "Effutu Municipal", code: "CR-EFM", localities: ["Winneba", "Senya Beraku"] },
        { name: "Mfantseman Municipal", code: "CR-MFM", localities: ["Saltpond", "Mankessim"] },
        { name: "Abura/Asebu/Kwamankese", code: "CR-AAK", localities: ["Abura", "Kwamankese"] },
        { name: "Gomoa East", code: "CR-GED", localities: ["Potin Fankore", "Amanful"] },
        { name: "Gomoa West", code: "CR-GWD", localities: ["Apam", "Tsafi"] },
      ],
    },
    {
      name: "Eastern",
      code: "ER",
      districts: [
        { name: "Koforidua Municipal", code: "ER-KFM", localities: ["Koforidua", "Gyankama", "Amanokrom"] },
        { name: "New Juaben South", code: "ER-NJS", localities: ["Koforidua", "Sawyer"] },
        { name: "New Juaben North", code: "ER-NJN", localities: ["Effiduase", "Asakraka"] },
        { name: "Akim Oda Municipal", code: "ER-AOM", localities: ["Oda", "Akyem"] },
        { name: "Birim Central", code: "ER-BIC", localities: ["Oda", "Asankrang"] },
        { name: "Akim Agona", code: "ER-AGA", localities: ["Agona", "Asamankese"] },
        { name: "East Akim", code: "ER-EAK", localities: ["Kibi", "Akyem"] },
        { name: "West Akim", code: "ER-WAK", localities: ["Asamankese", "Akyem"] },
      ],
    },
    {
      name: "Volta",
      code: "VR",
      districts: [
        { name: "Ho Municipal", code: "VR-HOM", localities: ["Ho", "Ho Polytechnic", "Kpegbo"] },
        { name: "Keta Municipal", code: "VR-KEM", localities: ["Keta", "Anloga"] },
        { name: "Hohoe Municipal", code: "VR-HHM", localities: ["Hohoe", "Alavanyo"] },
        { name: "South Dayi", code: "VR-SDY", localities: ["Kpeve", "Kpalime"] },
        { name: "North Dayi", code: "VR-NDY", localities: ["Anfoega", "Kadjebi"] },
        { name: "Akatsi South", code: "VR-ASO", localities: ["Akatsi", "Ave-Dakpa"] },
      ],
    },
    {
      name: "Northern",
      code: "NR",
      districts: [
        { name: "Tamale Metropolitan", code: "NR-TMA", localities: ["Tamale", "Gurugu", "Lamashegu", "Chang", "Somanya"] },
        { name: "Savelugu Municipal", code: "NR-SVM", localities: ["Savelugu", "Tampion"] },
        { name: "Tolon District", code: "NR-TOD", localities: ["Tolon", "Kumbungu"] },
        { name: "Kumbungu District", code: "NR-KUD", localities: ["Kumbungu", "Tohili"] },
        { name: "Mion District", code: "NR-MID", localities: ["Salaga", "Kpandai"] },
        { name: "West Gonja", code: "NR-WGO", localities: ["Damongo", "Buipe"] },
      ],
    },
    {
      name: "Upper East",
      code: "UE",
      districts: [
        { name: "Bolgatanga Municipal", code: "UE-BOM", localities: ["Bolgatanga", "Bongo", "Zuarungu"] },
        { name: "Bongo District", code: "UE-BOD", localities: ["Bongo", "Badomsa"] },
        { name: "Kasena Nankana West", code: "UE-KNW", localities: ["Navrongo", "Paga"] },
        { name: "Kasena Nankana East", code: "UE-KNE", localities: ["Navrongo", "Chiana"] },
        { name: "Builsa North", code: "UE-BUN", localities: ["Sandema", "Fumbisi"] },
      ],
    },
    {
      name: "Upper West",
      code: "UW",
      districts: [
        { name: "Wa Municipal", code: "UW-WAM", localities: ["Wa", "Boli", "Kpongu"] },
        { name: "Nadowli Kaleo", code: "UW-NKD", localities: ["Nadowli", "Kaleo"] },
        { name: "Jirapa", code: "UW-JIR", localities: ["Jirapa", "Lambussie"] },
        { name: "Lawra", code: "UW-LAW", localities: ["Lawra", "Nandom"] },
        { name: "Sissala East", code: "UW-SIE", localities: ["Tumu", "Gwollu"] },
      ],
    },
    {
      name: "Bono",
      code: "BR",
      districts: [
        { name: "Sunyani Municipal", code: "BR-SUM", localities: ["Sunyani", "Fiapre", "Brong"] },
        { name: "Sunyani West", code: "BR-SUW", localities: ["Odumase", "Kenyasi"] },
        { name: "Berekum Municipal", code: "BR-BEM", localities: ["Berekum", "Jinijini"] },
        { name: "Dormaa East", code: "BR-DOE", localities: ["Dormaa Ahenkro", "Wamfie"] },
        { name: "Tain", code: "BR-TAI", localities: ["Drobo", "Nsawkaw"] },
        { name: "Wenchi Municipal", code: "BR-WEM", localities: ["Wenchi", "Agyemang"] },
      ],
    },
    {
      name: "Bono East",
      code: "BE",
      districts: [
        { name: "Techiman Municipal", code: "BE-TEM", localities: ["Techiman", "Atebubu"] },
        { name: "Kintampo North", code: "BE-KNT", localities: ["Kintampo", "Jema"] },
        { name: "Kintampo South", code: "BE-KTS", localities: ["Jema", "Prang"] },
        { name: "Atebubu Amantin", code: "BE-AMA", localities: ["Atebubu", "Kwame Danso"] },
        { name: "Nkoranza South", code: "BE-NKS", localities: ["Nkoranza", "Afram"] },
      ],
    },
    {
      name: "Ahafo",
      code: "AF",
      districts: [
        { name: "Goaso Municipal", code: "AF-GOM", localities: ["Goaso", "Hwidiem"] },
        { name: "Asunafo North", code: "AF-ASN", localities: ["Goaso", "Kukuom"] },
        { name: "Asunafo South", code: "AF-ASS", localities: ["Bechem", "Hwidiem"] },
        { name: "Asutifi", code: "AF-ASF", localities: ["Kenyasi", "Hwedi"] },
        { name: "Tano North", code: "AF-TAN", localities: ["Duayaw Nkwanta", "Mim"] },
        { name: "Tano South", code: "AF-TAS", localities: ["Bechem", "Tano"] },
      ],
    },
    {
      name: "Savannah",
      code: "SV",
      districts: [
        { name: "Damango Municipal", code: "SV-DAM", localities: ["Damango", "Daboya"] },
        { name: "North Gonja", code: "SV-NGO", localities: ["Larabanga", "Buipe"] },
        { name: "South Gonja", code: "SV-SGO", localities: ["Bole", "Sawla"] },
        { name: "Central Gonja", code: "SV-CGO", localities: ["Daboya", "Kpa"] },
        { name: "West Gonja", code: "SV-WGO", localities: ["Damango", "Buipe"] },
      ],
    },
    {
      name: "North East",
      code: "NE",
      districts: [
        { name: "Nalerigu Gambaga", code: "NE-NGM", localities: ["Nalerigu", "Gambaga"] },
        { name: "West Mamprusi", code: "NE-WMA", localities: ["Walewale", "Gambaga"] },
        { name: "East Mamprusi", code: "NE-EMA", localities: ["Gambaga", "Kpasinkpe"] },
        { name: "Mamprugu Moagduri", code: "NE-MAM", localities: ["Yunyoo", "Pusiga"] },
      ],
    },
    {
      name: "Oti",
      code: "OT",
      districts: [
        { name: "Dambai", code: "OT-DAM", localities: ["Dambai", "Kadjebi"] },
        { name: "Krachi East", code: "OT-KRE", localities: ["Dambai", "Kete Krachi"] },
        { name: "Krachi West", code: "OT-KRW", localities: ["Kete Krachi", "Chinderi"] },
        { name: "Krachi Nchumuru", code: "OT-KNC", localities: ["Chinderi", "Banda"] },
        { name: "Nkwanta South", code: "OT-NKS", localities: ["Nkwanta", "Jasikan"] },
        { name: "Nkwanta North", code: "OT-NKN", localities: ["Nkwanta", "Kpassa"] },
      ],
    },
    {
      name: "Western North",
      code: "WN",
      districts: [
        { name: "Sefwi Wiawso", code: "WN-SEW", localities: ["Sefwi Wiawso", "Bibiani"] },
        { name: "Sefwi Akontombra", code: "WN-SEA", localities: ["Akontombra", "Sefwi"] },
        { name: "Bia East", code: "WN-BIE", localities: ["Adiembra", "Biami"] },
        { name: "Bia West", code: "WN-BIW", localities: ["Essam", "Adiembra"] },
        { name: "Aowin", code: "WN-AOW", localities: ["Enchi", "Sefwi"] },
        { name: "Juaboso", code: "WN-JUA", localities: ["Juaboso", "Sefwi"] },
      ],
    },
  ];

  for (const regionData of regionsData) {
    const region = await prisma.region.upsert({
      where: { code: regionData.code },
      update: {},
      create: {
        name: regionData.name,
        code: regionData.code,
        countryId: ghana.id,
        isActive: true,
      },
    });

    console.log(`  📍 Created region: ${region.name}`);

    for (const districtData of regionData.districts) {
      const district = await prisma.district.upsert({
        where: { code: districtData.code },
        update: {},
        create: {
          name: districtData.name,
          code: districtData.code,
          regionId: region.id,
          isActive: true,
        },
      });

      for (const localityName of districtData.localities) {
        await prisma.locality.upsert({
          where: {
            name_districtId: {
              name: localityName,
              districtId: district.id,
            },
          },
          update: {},
          create: {
            name: localityName,
            districtId: district.id,
            isActive: true,
          },
        });
      }
    }
  }

  // 3. Create a sample delivery zone covering Greater Accra
  const greaterAccraRegion = await prisma.region.findUnique({
    where: { code: "GA" },
    include: {
      districts: {
        include: { localities: true },
      },
    },
  });

  if (greaterAccraRegion) {
    const accraZone = await prisma.deliveryZone.upsert({
      where: { id: "sample-accra-zone" },
      update: {},
      create: {
        id: "sample-accra-zone",
        name: "Greater Accra Metropolitan",
        status: "ACTIVE",
        baseDeliveryFee: 15.0,
        minOrderValue: 50.0,
        codEnabled: true,
        onlinePayEnabled: true,
        estimatedDays: 2,
        notes: "Standard delivery for Greater Accra region",
      },
    });

    // Link all Greater Accra localities to this zone
    for (const district of greaterAccraRegion.districts) {
      for (const locality of district.localities) {
        await prisma.deliveryZoneLocality.upsert({
          where: {
            deliveryZoneId_localityId: {
              deliveryZoneId: accraZone.id,
              localityId: locality.id,
            },
          },
          update: {},
          create: {
            deliveryZoneId: accraZone.id,
            localityId: locality.id,
          },
        });
      }
    }

    console.log(`✅ Created delivery zone: ${accraZone.name} with ${greaterAccraRegion.districts.reduce((sum, d) => sum + d.localities.length, 0)} localities`);
  }

  console.log("🎉 Seeding complete!");
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });