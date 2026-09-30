import { NextResponse } from 'next/server'
import { UPSTREAMS } from '@/lib/upstreams'

interface GeocodeResult {
  lat: number
  lng: number
  name: string
  displayName: string
  state?: string
  district?: string
  type?: string
}

// Extensive Backup Dictionary of 150+ Indian Cities, Districts, Mining Areas & Capitals
const INDIAN_LOCATIONS_DB: Record<string, { lat: number; lng: number; name: string; state: string; type?: string }> = {
  // Major Capitals & Metros
  'new delhi': { lat: 28.6139, lng: 77.209, name: 'New Delhi', state: 'Delhi', type: 'Capital' },
  'delhi': { lat: 28.6562, lng: 77.241, name: 'Delhi NCR', state: 'Delhi', type: 'Metro' },
  'mumbai': { lat: 19.076, lng: 72.8777, name: 'Mumbai', state: 'Maharashtra', type: 'Metro' },
  'kolkata': { lat: 22.5726, lng: 88.3639, name: 'Kolkata', state: 'West Bengal', type: 'Metro' },
  'chennai': { lat: 13.0827, lng: 80.2707, name: 'Chennai', state: 'Tamil Nadu', type: 'Metro' },
  'bengaluru': { lat: 12.9716, lng: 77.5946, name: 'Bengaluru', state: 'Karnataka', type: 'Metro' },
  'bangalore': { lat: 12.9716, lng: 77.5946, name: 'Bangalore', state: 'Karnataka', type: 'Metro' },
  'hyderabad': { lat: 17.385, lng: 78.4867, name: 'Hyderabad', state: 'Telangana', type: 'Metro' },
  'ahmedabad': { lat: 23.0225, lng: 72.5714, name: 'Ahmedabad', state: 'Gujarat', type: 'Metro' },
  'pune': { lat: 18.5204, lng: 73.8567, name: 'Pune', state: 'Maharashtra', type: 'Metro' },
  'surat': { lat: 21.1702, lng: 72.8311, name: 'Surat', state: 'Gujarat', type: 'Metro' },
  'jaipur': { lat: 26.9124, lng: 75.7873, name: 'Jaipur', state: 'Rajasthan', type: 'Capital' },
  'lucknow': { lat: 26.8467, lng: 80.9462, name: 'Lucknow', state: 'Uttar Pradesh', type: 'Capital' },
  'kanpur': { lat: 26.4499, lng: 80.3319, name: 'Kanpur', state: 'Uttar Pradesh', type: 'City' },
  'nagpur': { lat: 21.1458, lng: 79.0882, name: 'Nagpur', state: 'Maharashtra', type: 'MOIL HQ Zone' },
  'bhopal': { lat: 23.2599, lng: 77.4126, name: 'Bhopal', state: 'Madhya Pradesh', type: 'Capital' },
  'indore': { lat: 22.7196, lng: 75.8577, name: 'Indore', state: 'Madhya Pradesh', type: 'City' },
  'patna': { lat: 25.5941, lng: 85.1376, name: 'Patna', state: 'Bihar', type: 'Capital' },
  'vadodara': { lat: 22.3072, lng: 73.1812, name: 'Vadodara', state: 'Gujarat', type: 'City' },
  'ghaziabad': { lat: 28.6692, lng: 77.4538, name: 'Ghaziabad', state: 'Uttar Pradesh', type: 'City' },
  'noida': { lat: 28.5355, lng: 77.391, name: 'Noida', state: 'Uttar Pradesh', type: 'IT/Industrial Hub' },
  'greater noida': { lat: 28.4744, lng: 77.504, name: 'Greater Noida', state: 'Uttar Pradesh', type: 'Industrial' },
  'gurgaon': { lat: 28.4595, lng: 77.0266, name: 'Gurgaon', state: 'Haryana', type: 'IT/Industrial Hub' },
  'gurugram': { lat: 28.4595, lng: 77.0266, name: 'Gurugram', state: 'Haryana', type: 'IT/Industrial Hub' },
  'ludhiana': { lat: 30.901, lng: 75.8573, name: 'Ludhiana', state: 'Punjab', type: 'City' },
  'agra': { lat: 27.1767, lng: 78.0081, name: 'Agra', state: 'Uttar Pradesh', type: 'City' },
  'nashik': { lat: 19.9975, lng: 73.7898, name: 'Nashik', state: 'Maharashtra', type: 'City' },
  'faridabad': { lat: 28.4089, lng: 77.3178, name: 'Faridabad', state: 'Haryana', type: 'City' },
  'meerut': { lat: 28.9845, lng: 77.7064, name: 'Meerut', state: 'Uttar Pradesh', type: 'City' },
  'rajkot': { lat: 22.3039, lng: 70.8022, name: 'Rajkot', state: 'Gujarat', type: 'City' },
  'varanasi': { lat: 25.3176, lng: 82.9739, name: 'Varanasi', state: 'Uttar Pradesh', type: 'City' },
  'srinagar': { lat: 34.0837, lng: 74.7973, name: 'Srinagar', state: 'Jammu & Kashmir', type: 'Capital' },
  'aurangabad': { lat: 19.8762, lng: 75.3433, name: 'Chhatrapati Sambhajinagar (Aurangabad)', state: 'Maharashtra', type: 'City' },
  'chhatrapati sambhajinagar': { lat: 19.8762, lng: 75.3433, name: 'Chhatrapati Sambhajinagar', state: 'Maharashtra', type: 'City' },
  'dhanbad': { lat: 23.7957, lng: 86.4304, name: 'Dhanbad Mining Belt', state: 'Jharkhand', type: 'Mining Hub' },
  'amritsar': { lat: 31.634, lng: 74.8723, name: 'Amritsar', state: 'Punjab', type: 'City' },
  'navi mumbai': { lat: 19.033, lng: 73.0297, name: 'Navi Mumbai', state: 'Maharashtra', type: 'City' },
  'allahabad': { lat: 25.4358, lng: 81.8463, name: 'Prayagraj (Allahabad)', state: 'Uttar Pradesh', type: 'City' },
  'prayagraj': { lat: 25.4358, lng: 81.8463, name: 'Prayagraj', state: 'Uttar Pradesh', type: 'City' },
  'ranchi': { lat: 23.3441, lng: 85.3096, name: 'Ranchi', state: 'Jharkhand', type: 'Capital' },
  'howrah': { lat: 22.5958, lng: 88.2636, name: 'Howrah', state: 'West Bengal', type: 'City' },
  'coimbatore': { lat: 11.0168, lng: 76.9558, name: 'Coimbatore', state: 'Tamil Nadu', type: 'City' },
  'jabalpur': { lat: 23.1815, lng: 79.9864, name: 'Jabalpur', state: 'Madhya Pradesh', type: 'City' },
  'gwalior': { lat: 26.2183, lng: 78.1828, name: 'Gwalior', state: 'Madhya Pradesh', type: 'City' },
  'vijayawada': { lat: 16.5062, lng: 80.648, name: 'Vijayawada', state: 'Andhra Pradesh', type: 'City' },
  'jodhpur': { lat: 26.2389, lng: 73.0243, name: 'Jodhpur', state: 'Rajasthan', type: 'City' },
  'madurai': { lat: 9.9252, lng: 78.1198, name: 'Madurai', state: 'Tamil Nadu', type: 'City' },
  'raipur': { lat: 21.2514, lng: 81.6296, name: 'Raipur', state: 'Chhattisgarh', type: 'Capital' },
  'kota': { lat: 25.2138, lng: 75.8648, name: 'Kota', state: 'Rajasthan', type: 'City' },
  'guwahati': { lat: 26.1445, lng: 91.7362, name: 'Guwahati', state: 'Assam', type: 'City' },
  'chandigarh': { lat: 30.7333, lng: 76.7794, name: 'Chandigarh', state: 'Chandigarh UT', type: 'Capital' },
  'solapur': { lat: 17.6599, lng: 75.9064, name: 'Solapur', state: 'Maharashtra', type: 'City' },
  'bareilly': { lat: 28.367, lng: 79.4304, name: 'Bareilly', state: 'Uttar Pradesh', type: 'City' },
  'mysore': { lat: 12.2958, lng: 76.6394, name: 'Mysuru (Mysore)', state: 'Karnataka', type: 'City' },
  'mysuru': { lat: 12.2958, lng: 76.6394, name: 'Mysuru', state: 'Karnataka', type: 'City' },
  'aligarh': { lat: 27.8974, lng: 78.088, name: 'Aligarh', state: 'Uttar Pradesh', type: 'City' },
  'jalandhar': { lat: 31.326, lng: 75.5762, name: 'Jalandhar', state: 'Punjab', type: 'City' },
  'bhubaneswar': { lat: 20.2961, lng: 85.8245, name: 'Bhubaneswar', state: 'Odisha', type: 'Capital' },
  'salem': { lat: 11.6643, lng: 78.146, name: 'Salem', state: 'Tamil Nadu', type: 'City' },
  'warangal': { lat: 17.9689, lng: 79.5941, name: 'Warangal', state: 'Telangana', type: 'City' },
  'thiruvananthapuram': { lat: 8.5241, lng: 76.9366, name: 'Thiruvananthapuram', state: 'Kerala', type: 'Capital' },
  'trivandrum': { lat: 8.5241, lng: 76.9366, name: 'Thiruvananthapuram', state: 'Kerala', type: 'Capital' },
  'bhiwandi': { lat: 19.2813, lng: 73.0483, name: 'Bhiwandi', state: 'Maharashtra', type: 'City' },
  'saharanpur': { lat: 29.964, lng: 77.546, name: 'Saharanpur', state: 'Uttar Pradesh', type: 'City' },
  'amravati': { lat: 20.9374, lng: 77.7796, name: 'Amravati', state: 'Maharashtra', type: 'City' },
  'bikaner': { lat: 28.0229, lng: 73.3119, name: 'Bikaner', state: 'Rajasthan', type: 'City' },
  'mangalore': { lat: 12.9141, lng: 74.856, name: 'Mangaluru (Mangalore)', state: 'Karnataka', type: 'City' },
  'mangaluru': { lat: 12.9141, lng: 74.856, name: 'Mangaluru', state: 'Karnataka', type: 'City' },
  'belgaum': { lat: 15.8497, lng: 74.4977, name: 'Belagavi (Belgaum)', state: 'Karnataka', type: 'City' },
  'belagavi': { lat: 15.8497, lng: 74.4977, name: 'Belagavi', state: 'Karnataka', type: 'City' },
  'cuttack': { lat: 20.4625, lng: 85.8828, name: 'Cuttack', state: 'Odisha', type: 'City' },
  'dehradun': { lat: 30.3165, lng: 78.0322, name: 'Dehradun', state: 'Uttarakhand', type: 'Capital' },
  'durgapur': { lat: 23.5204, lng: 87.3119, name: 'Durgapur Industrial Belt', state: 'West Bengal', type: 'Industrial' },
  'asansol': { lat: 23.6889, lng: 86.9661, name: 'Asansol Mineral Belt', state: 'West Bengal', type: 'Mining Hub' },
  'nanded': { lat: 19.1383, lng: 77.321, name: 'Nanded', state: 'Maharashtra', type: 'City' },
  'kolhapur': { lat: 16.705, lng: 74.2433, name: 'Kolhapur', state: 'Maharashtra', type: 'City' },
  'ajmer': { lat: 26.4499, lng: 74.6399, name: 'Ajmer', state: 'Rajasthan', type: 'City' },
  'gulbarga': { lat: 17.3297, lng: 76.8343, name: 'Kalaburagi (Gulbarga)', state: 'Karnataka', type: 'City' },
  'jamnagar': { lat: 22.4707, lng: 70.0577, name: 'Jamnagar', state: 'Gujarat', type: 'City' },
  'ujjain': { lat: 23.1765, lng: 75.7885, name: 'Ujjain', state: 'Madhya Pradesh', type: 'City' },
  'siliguri': { lat: 26.7271, lng: 88.3953, name: 'Siliguri', state: 'West Bengal', type: 'City' },
  'jhansi': { lat: 25.4484, lng: 78.5685, name: 'Jhansi', state: 'Uttar Pradesh', type: 'City' },
  'jammu': { lat: 32.7266, lng: 74.857, name: 'Jammu', state: 'Jammu & Kashmir', type: 'City' },
  'sangli': { lat: 16.8524, lng: 74.5815, name: 'Sangli', state: 'Maharashtra', type: 'City' },
  'kozhikode': { lat: 11.2588, lng: 75.7804, name: 'Kozhikode (Calicut)', state: 'Kerala', type: 'City' },
  'calicut': { lat: 11.2588, lng: 75.7804, name: 'Kozhikode', state: 'Kerala', type: 'City' },
  'kochi': { lat: 9.9312, lng: 76.2673, name: 'Kochi (Cochin)', state: 'Kerala', type: 'City' },
  'cochin': { lat: 9.9312, lng: 76.2673, name: 'Kochi', state: 'Kerala', type: 'City' },
  'akola': { lat: 20.7002, lng: 77.0082, name: 'Akola', state: 'Maharashtra', type: 'City' },
  'bokaro': { lat: 23.6693, lng: 86.1511, name: 'Bokaro Steel City', state: 'Jharkhand', type: 'Steel Hub' },
  'agartala': { lat: 23.8315, lng: 91.2868, name: 'Agartala', state: 'Tripura', type: 'Capital' },
  'bhagalpur': { lat: 25.2425, lng: 86.9842, name: 'Bhagalpur', state: 'Bihar', type: 'City' },
  'latur': { lat: 18.4088, lng: 76.5604, name: 'Latur', state: 'Maharashtra', type: 'City' },
  'dhule': { lat: 20.9042, lng: 74.7749, name: 'Dhule', state: 'Maharashtra', type: 'City' },
  'korba': { lat: 22.3595, lng: 82.7501, name: 'Korba Energy Belt', state: 'Chhattisgarh', type: 'Mining Hub' },
  'bhilai': { lat: 21.1938, lng: 81.3509, name: 'Bhilai Steel Corridor', state: 'Chhattisgarh', type: 'Steel Hub' },
  'shimla': { lat: 31.1048, lng: 77.1734, name: 'Shimla', state: 'Himachal Pradesh', type: 'Capital' },
  'shillong': { lat: 25.5788, lng: 91.8933, name: 'Shillong', state: 'Meghalaya', type: 'Capital' },
  'gangtok': { lat: 27.3389, lng: 88.6065, name: 'Gangtok', state: 'Sikkim', type: 'Capital' },
  'itanagar': { lat: 27.0844, lng: 93.6053, name: 'Itanagar', state: 'Arunachal Pradesh', type: 'Capital' },
  'kohima': { lat: 25.6751, lng: 94.1086, name: 'Kohima', state: 'Nagaland', type: 'Capital' },
  'imphal': { lat: 24.817, lng: 93.9368, name: 'Imphal', state: 'Manipur', type: 'Capital' },
  'aizawl': { lat: 23.7271, lng: 92.7176, name: 'Aizawl', state: 'Mizoram', type: 'Capital' },
  'panaji': { lat: 15.4989, lng: 73.8278, name: 'Panaji', state: 'Goa', type: 'Capital' },
  'goa': { lat: 15.2993, lng: 74.124, name: 'Goa Iron-Mn Ore Belt', state: 'Goa', type: 'Mining Belt' },

  // Primary Indian Mining & Mineral Belts (MOIL & Manganese Priorities)
  'balaghat': { lat: 21.83, lng: 80.19, name: 'Balaghat Pyrolusite Syncline', state: 'Madhya Pradesh', type: 'MOIL Mine Hub' },
  'bharweli': { lat: 21.86, lng: 80.26, name: 'Bharweli Underground Mine', state: 'Madhya Pradesh', type: 'MOIL Mine Hub' },
  'ukwa': { lat: 21.93, lng: 80.52, name: 'Ukwa Siliceous Reef', state: 'Madhya Pradesh', type: 'MOIL Mine Hub' },
  'tirodi': { lat: 22.16, lng: 79.68, name: 'Tirodi Gondite Facies', state: 'Madhya Pradesh', type: 'MOIL Mine Hub' },
  'dongri buzurg': { lat: 20.99, lng: 79.34, name: 'Dongri Buzurg Ore Belt', state: 'Maharashtra', type: 'MOIL Mine Hub' },
  'dongri': { lat: 20.99, lng: 79.34, name: 'Dongri Buzurg Ore Belt', state: 'Maharashtra', type: 'MOIL Mine Hub' },
  'mansar': { lat: 21.44, lng: 79.25, name: 'Mansar Manganese Mine', state: 'Maharashtra', type: 'MOIL Mine Hub' },
  'kandri': { lat: 21.38, lng: 79.32, name: 'Kandri Ore Complex', state: 'Maharashtra', type: 'MOIL Mine Hub' },
  'chikla': { lat: 21.3, lng: 79.66, name: 'Chikla Underground Mine', state: 'Maharashtra', type: 'MOIL Mine Hub' },
  'gumgaon': { lat: 21.33, lng: 79.03, name: 'Gumgaon Ore Sector', state: 'Maharashtra', type: 'MOIL Mine Hub' },
  'beldongri': { lat: 21.16, lng: 79.18, name: 'Beldongri Prospect Zone', state: 'Maharashtra', type: 'MOIL Mine Hub' },
  'bhandara': { lat: 21.17, lng: 79.65, name: 'Bhandara Gondite Belt', state: 'Maharashtra', type: 'Mining District' },
  'gondia': { lat: 21.4598, lng: 80.1961, name: 'Gondia Sub-Surface Sector', state: 'Maharashtra', type: 'Mining Corridor' },
  'chhindwara': { lat: 22.0574, lng: 78.9382, name: 'Chhindwara Manganese Extension', state: 'Madhya Pradesh', type: 'Mining Belt' },
  'sausar': { lat: 21.65, lng: 78.78, name: 'Sausar Group Metamorphic Series', state: 'Madhya Pradesh', type: 'Geological Formation' },
  'keonjhar': { lat: 21.6289, lng: 85.5817, name: 'Keonjhar Iron-Manganese Belt', state: 'Odisha', type: 'Mining Hub' },
  'kendujhar': { lat: 21.6289, lng: 85.5817, name: 'Kendujhar (Keonjhar)', state: 'Odisha', type: 'Mining Hub' },
  'sundargarh': { lat: 22.12, lng: 84.03, name: 'Sundargarh Ore Horizon', state: 'Odisha', type: 'Mining District' },
  'rourkela': { lat: 22.2604, lng: 84.8536, name: 'Rourkela Steel Corridor', state: 'Odisha', type: 'Steel Hub' },
  'singhbhum': { lat: 22.56, lng: 85.78, name: 'Singhbhum Shear Zone', state: 'Jharkhand', type: 'Mining District' },
  'bellary': { lat: 15.1394, lng: 76.9214, name: 'Bellary Iron-Mn Basin', state: 'Karnataka', type: 'Mining Hub' },
  'ballari': { lat: 15.1394, lng: 76.9214, name: 'Ballari (Bellary)', state: 'Karnataka', type: 'Mining Hub' },
  'sandur': { lat: 15.0833, lng: 76.55, name: 'Sandur Schist Belt', state: 'Karnataka', type: 'Mining Sector' },
  'panchmahal': { lat: 22.77, lng: 73.61, name: 'Panchmahal Manganese Belt', state: 'Gujarat', type: 'Mining Belt' },
  'singrauli': { lat: 24.1994, lng: 82.6657, name: 'Singrauli Energy Basin', state: 'Madhya Pradesh', type: 'Energy Hub' },
  'visakhapatnam': { lat: 17.6868, lng: 83.2185, name: 'Visakhapatnam Port & Steel Sector', state: 'Andhra Pradesh', type: 'Port/Steel Hub' },
  'vizag': { lat: 17.6868, lng: 83.2185, name: 'Vizag Port Corridor', state: 'Andhra Pradesh', type: 'Port/Steel Hub' },
  'srikakulam': { lat: 18.2969, lng: 83.8968, name: 'Srikakulam Manganese Belt', state: 'Andhra Pradesh', type: 'Mining District' },
  'shimoga': { lat: 13.9299, lng: 75.5681, name: 'Shivamogga (Shimoga) Schist Belt', state: 'Karnataka', type: 'Mining District' },
  'shivamogga': { lat: 13.9299, lng: 75.5681, name: 'Shivamogga Schist Belt', state: 'Karnataka', type: 'Mining District' },
  'udaipur': { lat: 24.5854, lng: 73.7125, name: 'Udaipur Aravalli Mineral Corridor', state: 'Rajasthan', type: 'Mining District' },
  'bhilwara': { lat: 25.3407, lng: 74.6313, name: 'Bhilwara Lead-Zinc-Mn Belt', state: 'Rajasthan', type: 'Mining District' },
  'satna': { lat: 24.6005, lng: 80.8322, name: 'Satna Limestone & Mineral Zone', state: 'Madhya Pradesh', type: 'Mining District' },
  'katni': { lat: 23.8343, lng: 80.3995, name: 'Katni Bauxite-Mn Mineral Corridor', state: 'Madhya Pradesh', type: 'Mining Hub' },
  'rewa': { lat: 24.5362, lng: 81.3037, name: 'Rewa Mineral Zone', state: 'Madhya Pradesh', type: 'City' },
  'seoni': { lat: 22.085, lng: 79.544, name: 'Seoni Metamorphic Zone', state: 'Madhya Pradesh', type: 'District' },
  'wardha': { lat: 20.7453, lng: 78.6022, name: 'Wardha Valley Corridor', state: 'Maharashtra', type: 'District' },
  'chandrapur': { lat: 19.9615, lng: 79.2961, name: 'Chandrapur Coal-Mn Ore Belt', state: 'Maharashtra', type: 'Mining District' },
  'gadchiroli': { lat: 20.1833, lng: 80.0, name: 'Gadchiroli Mineral Zone', state: 'Maharashtra', type: 'Mining District' },
  'yavatmal': { lat: 20.3888, lng: 78.1204, name: 'Yavatmal Limestone-Mn Sector', state: 'Maharashtra', type: 'District' },
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const rawQuery = searchParams.get('q')?.trim() || ''

    if (!rawQuery) {
      return NextResponse.json({ success: true, query: '', results: [] })
    }

    const queryLower = rawQuery.toLowerCase()
    const results: GeocodeResult[] = []

    // 1. Direct match in local 150+ Indian locations database
    for (const [key, item] of Object.entries(INDIAN_LOCATIONS_DB)) {
      if (queryLower === key || queryLower.startsWith(key) || key.startsWith(queryLower)) {
        results.push({
          lat: item.lat,
          lng: item.lng,
          name: item.name,
          displayName: `${item.name}, ${item.state}, India`,
          state: item.state,
          type: item.type || 'Preset Location',
        })
      }
    }

    // 2. Fetch from OpenStreetMap Nominatim with strict custom User-Agent header (Server-Side)
    try {
      const searchTerm = rawQuery.toLowerCase().includes('india') ? rawQuery : `${rawQuery}, India`
      const url = `${UPSTREAMS.nominatim}/search?format=json&q=${encodeURIComponent(
        searchTerm
      )}&countrycodes=in&limit=8&addressdetails=1`

      const res = await fetch(url, {
        headers: {
          'User-Agent': 'NakshatraX-MOIL-CommandCenter/1.0 (contact@nakshatra-x.gov.in)',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        next: { revalidate: 3600 }, // Cache search queries for 1 hour
      })

      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data) && data.length > 0) {
          for (const item of data) {
            const lat = parseFloat(item.lat)
            const lng = parseFloat(item.lon)

            // Validate geographic bounds for India (Lat: 6.0 to 37.5, Lng: 68.0 to 97.5)
            if (!isNaN(lat) && !isNaN(lng) && lat >= 6.0 && lat <= 37.5 && lng >= 68.0 && lng <= 97.5) {
              const placeName = item.name || item.display_name.split(',')[0]
              const address = item.address || {}
              const state = address.state || address.region || 'India'
              const district = address.state_district || address.county || address.city

              // Avoid duplicate lat/lng in results list
              const isDuplicate = results.some(
                (r) => Math.abs(r.lat - lat) < 0.005 && Math.abs(r.lng - lng) < 0.005
              )
              if (!isDuplicate) {
                results.push({
                  lat,
                  lng,
                  name: placeName,
                  displayName: item.display_name,
                  state,
                  district,
                  type: item.type || item.class || 'Location',
                })
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn('Server Nominatim geocoding error:', e)
    }

    // 3. Fallback: Fetch from Photon Komoot API if results are still empty
    if (results.length === 0) {
      try {
        const photonUrl = `${UPSTREAMS.photon}/api/?q=${encodeURIComponent(
          rawQuery + ' India'
        )}&bbox=68.1,6.5,97.4,35.5&limit=5`

        const photonRes = await fetch(photonUrl, {
          headers: {
            'User-Agent': 'NakshatraX-MOIL-CommandCenter/1.0',
          },
        })

        if (photonRes.ok) {
          const pData = await photonRes.json()
          if (pData?.features?.length > 0) {
            for (const feat of pData.features) {
              const coords = feat.geometry?.coordinates
              if (coords && coords.length >= 2) {
                const lng = coords[0]
                const lat = coords[1]

                if (lat >= 6.0 && lat <= 37.5 && lng >= 68.0 && lng <= 97.5) {
                  const props = feat.properties || {}
                  const name = props.name || rawQuery
                  const state = props.state || 'India'
                  const city = props.city || props.district

                  results.push({
                    lat,
                    lng,
                    name,
                    displayName: [name, city, state, 'India'].filter(Boolean).join(', '),
                    state,
                    district: city,
                    type: props.osm_value || 'Location',
                  })
                }
              }
            }
          }
        }
      } catch (e) {
        console.warn('Photon geocoding error:', e)
      }
    }

    return NextResponse.json({
      success: true,
      query: rawQuery,
      count: results.length,
      results,
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Geocoding failed' },
      { status: 500 }
    )
  }
}
