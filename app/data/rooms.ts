export interface Room {
  id: string
  title: string
  client: string // Representing the building/wing name
  img: string
  tagline: string
  description: string[]
  features: string[]
  price: string
  priceNote: string
  sqm: string
  occupancy: string // Recontextualized for optimal family size / capacity
  bed: string // Recontextualized for unit configuration type
}

export const rooms: Room[] = [
  {
    id: '01',
    title: 'Executive 1-Bedroom Penthouse',
    client: 'Westview Apartments - Phase 1',
    img: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1600&h=900&fit=crop&q=80',
    tagline: 'Sun-drenched modern apartment opening directly onto a private balcony.',
    description: [
      'Located in the premium wing of Westview Apartments, this corner penthouse features an expansive seven-meter floor-to-ceiling glass wall that glides back entirely to merge your indoor living space with the city skyline view.',
      'The interiors showcase a minimalist design framework—limewashed walls, light oak hardwood flooring, and neutral linen drapery. The master en-suite is built out with solid premium travertine stone, including a freestanding soaking tub.',
    ],
    features: [
      'Retractable floor-to-ceiling sliding glass facade',
      'Spacious panoramic private balcony (14m²)',
      'Travertine en-suite bathroom with deep soaking tub',
      'Master bedroom with custom built-in floor wardrobes',
      'Fully integrated smart-home console and tea/coffee bar',
      '24/7 dedicated concierge service and daily facility maintenance',
    ],
    price: 'KES 45,000',
    priceNote: 'per month, exclusive of service charge',
    sqm: '55m²',
    occupancy: '1-2 residents',
    bed: '1BR Layout',
  },
  {
    id: '02',
    title: 'Luxury 2-Bedroom Garden Duplex',
    client: 'Coral Residences',
    img: 'https://images.unsplash.com/photo-1540541338287-41700207dee6?w=1600&h=900&fit=crop&q=80',
    tagline: 'Two-bedroom ground floor unit featuring a private plunge pool.',
    description: [
      'Tucked away behind secure perimeter stone walls, this standout duplex unit offers the ultimate privacy within the development. Private French doors lead to a manicured garden of mature trees, a private pool, and a sunken outdoor lounge.',
      'Inside, two master en-suite bedrooms flank a high-ceiling, open-plan living room complete with a functioning wood-burning fireplace. The kitchen layout is fully fitted with integrated appliances.',
    ],
    features: [
      'Two master en-suite bedrooms with walk-in closets',
      'Private 10m heated plunge pool and private lawn',
      'Outdoor tiled terrace with space for an 8-seater dining table',
      'Dedicated property manager on-call and complex backup generator',
      'Functional wood-burning fireplace and walk-in kitchen pantry',
      'Secure gate access, only 90 seconds walking distance to the complex gym',
    ],
    price: 'KES 180,000',
    priceNote: 'per month, 1-month deposit required',
    sqm: '180m²',
    occupancy: 'Family (up to 4)',
    bed: '2BR Duplex',
  },
  {
    id: '03',
    title: 'The Horizon Loft (Studio)',
    client: 'Sky Terrace Heights',
    img: 'https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=1600&h=900&fit=crop&q=80',
    tagline: 'A double-height loft at the peak of the development.',
    description: [
      'Occupying the prime top floor of the Sky Terrace wing, this open-concept loft maximizes volume and light. The ceilings soar to five meters, flanked by south-facing window arrays running floor to rafter.',
      'A structural mezzanine library overlooks the primary living area, offering a quiet workspace optimized for late-afternoon natural light. The bedroom area is thoughtfully placed on the lower floor for privacy.',
    ],
    features: [
      'Double-height open living space with 5m clearance',
      'Built-in mezzanine library/study space for home office setups',
      'Unobstructed 180° panoramic urban views',
      'Ground-level bedroom zone looking into a quiet courtyard',
      'High-pressure rainfall shower and freestanding bathtub',
      'Pre-wired for fiber internet and Bang & Olufsen sound systems',
    ],
    price: 'KES 65,000',
    priceNote: 'per month, inclusive of water bill',
    sqm: '70m²',
    occupancy: 'Single Professional',
    bed: 'Studio Loft',
  },
  {
    id: '04',
    title: 'Urban Courtyard Studio',
    client: 'Tide Pavilion Block',
    img: 'https://images.unsplash.com/photo-1582719508461-905c673771fd?w=1600&h=900&fit=crop&q=80',
    tagline: 'An efficient, open-plan layout steps from the complex garden.',
    description: [
      'The Tide Pavilion consists of six low-rise, modern gabled blocks running parallel to the central courtyard. Each studio offers clean lines, optimal spatial efficiency, and dedicated zones for sleeping, remote work, and lounging.',
      'Large sliding tracks open directly onto a private wooden deck with steps down to the main shared green park. No long common corridors or upstairs units to worry about.',
    ],
    features: [
      'Direct ground-floor access with zero staircase navigation',
      'Private treated-timber deck suitable for outdoor furniture',
      'Optimized open-plan studio layout maximizing usable area',
      'Dedicated kitchen alcove with natural wood finish counters',
      'Enclosed outdoor-indoor glass shower room',
      'Complimentary trash collection and secure basement parking space',
    ],
    price: 'KES 30,000',
    priceNote: 'per month, fixed 1-year lease',
    sqm: '40m²',
    occupancy: '1 Resident',
    bed: 'Studio Layout',
  },
  {
    id: '05',
    title: 'The Crestview Suite',
    client: 'Cove Residential Tower',
    img: 'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?w=1600&h=900&fit=crop&q=80',
    tagline: 'A ruggedly designed architectural suite with an outdoor patio tub.',
    description: [
      'Situated on the north corner of the property where the land profile elevates over the valley, this suite blends raw architectural elements with luxury. One interior wall features exposed raw local masonry, keeping the unit naturally cool.',
      'The private terrace features a deep copper soaking tub positioned perfectly to catch sunset views over the valley. The property maintenance team manages the surrounding foliage to guarantee full visual privacy.',
    ],
    features: [
      'Private outdoor copper soaking tub installed on the terrace',
      'Exposed architectural natural stone accent feature wall',
      'West-facing orientation optimized for evening light',
      'Spacious main bedroom area with integrated lighting arrays',
      'Private trash chute access and utility room connection',
      'Automated security shutters and exterior architectural lighting',
    ],
    price: 'KES 95,000',
    priceNote: 'per month, service charge included',
    sqm: '85m²',
    occupancy: '1-2 residents',
    bed: '1BR Premium',
  },
  {
    id: '06',
    title: 'The Signature 3-Bedroom Villa',
    client: 'Palm Terrace Estates',
    img: 'https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=1600&h=900&fit=crop&q=80',
    tagline: 'A premier multi-level estate featuring a full 22-meter infinity pool.',
    description: [
      'As the crown jewel of the entire property collection, this sprawling multi-bedroom villa sits on a generous parcel at the western corner of the estate. Three expansive en-suite bedrooms wrap around a central paved open-air atrium.',
      'The defining feature is a spectacular 22-meter rim-flow infinity pool running along the property perimeter. Rental includes a dedicated compound steward and 24/7 priority maintenance ticketing privileges.',
    ],
    features: [
      'Private 22-meter rim-flow infinity pool on the property line',
      'Three massive king-size bedrooms, each with full en-suite bathrooms',
      'Separate attached domestic staff quarters (DSQ) with independent access',
      'Complimentary access to the exclusive community clubhouse and sports courts',
      'Assigned personal property concierge and daily compound groundskeeping',
      'Secure multi-car garage with electric vehicle charging docks installed',
    ],
    price: 'KES 250,000',
    priceNote: 'per month, minimum 6-month commitment',
    sqm: '320m²',
    occupancy: 'Family (up to 6)',
    bed: '3BR Estate',
  },
]