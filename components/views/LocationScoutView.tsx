import React, { useState, useMemo } from 'react';
import { useProject } from '../../context/ProjectContext';
import { 
    LocationMapping, SceneRequirement 
} from '../../types';
import { 
    MapPin, Building, Hospital, Users, Zap, ShieldAlert, Search, Plus, 
    Edit3, Trash2, CheckCircle2, Clock, Phone, Navigation, ExternalLink, 
    Layers, Clapperboard, Sparkles, X, ChevronRight, AlertCircle, Compass, Key,
    Car, Scissors, Shield, Video, PackageCheck, Map as MapIcon, Filter, Layers2,
    Calendar, ArrowRight, ArrowUpRight
} from 'lucide-react';

// Default Initial Locations with Scenes Assigned & Scene Requirements
const DEFAULT_LOCATIONS: LocationMapping[] = [
    {
        id: 'loc-ooty',
        scriptLocation: 'OOTY - PINE FORESTS & HILL RESERVE',
        sceneNumbers: ['SCENE 2', 'SCENE 5', 'SCENE 9'],
        realLocationName: 'Pine Forest Reserve, Ooty, Nilgiris, Tamil Nadu',
        address: 'Pine Forest Road, Fingerpost, Ooty, Tamil Nadu 643006',
        googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=Pine+Forest+Reserve+Ooty+Tamil+Nadu',
        coordinates: { lat: 11.4102, lng: 76.6950 },
        status: 'confirmed',
        contactPerson: 'K. Ramanathan (Forest Officer Ooty)',
        contactPhone: '+91 94430 12890',
        permitStatus: 'Approved',
        dailyRate: '₹85,000 / day',
        notes: 'Eco-sensitive zone. Plastic prohibited. Generator vans parked 200m away.',
        assignedScenes: [
            {
                sceneNumber: 'SCENE 2',
                slugline: 'EXT. OOTY PINE FOREST - DAY',
                timeOfDay: 'DAY',
                pageCount: '2 4/8 pgs',
                synopsis: 'Vikram tracks the mysterious wooden chest deep inside the misty pine trees while Meera keeps watch near the log cabin.',
                actors: [
                    { character: 'VIKRAM (Lead)', actorName: 'Actor Vikram', role: 'Main Lead', notes: 'Arrives 06:00 AM, Stunt double ready' },
                    { character: 'MEERA (Heroine)', actorName: 'Actress Meera', role: 'Lead Female', notes: 'Arrives 07:00 AM, Misty hair FX' }
                ],
                bigSetsAndProps: [
                    'Rustic Wooden Log Cabin Set',
                    'Carved Antique Wooden Chest',
                    'High-power Military Binoculars',
                    'Old Topographic Map of Nilgiris'
                ],
                vehicles: [
                    '1978 Vintage Willys Jeep (Forest Green)',
                    'Forest Ranger Patrol Vehicle'
                ],
                makeupAndCostumes: [
                    'Heavy Woolen Tweed Overcoat & Leather Gloves',
                    'Muddy Boots & Dirt Touch-up FX',
                    'Rain/Mist Moist Skin Makeup'
                ],
                stuntsAndSfx: [
                    'Artificial Low-Lying Fog Machine',
                    'Mist Water Rigging',
                    'Tree-top Chase Stunt Wire Setup'
                ],
                specialEquipment: [
                    'Steadicam Rig with Wireless Focus',
                    '50ft Heavy Camera Track'
                ]
            },
            {
                sceneNumber: 'SCENE 5',
                slugline: 'EXT. OOTY HILLS OVERLOOK - SUNSET',
                timeOfDay: 'SUNSET',
                pageCount: '1 2/8 pgs',
                synopsis: 'Vikram confronts Raghava on the cliff edge as the sun sets over the valley.',
                actors: [
                    { character: 'VIKRAM (Lead)', actorName: 'Actor Vikram', role: 'Main Lead' },
                    { character: 'RAGHAVA (Antagonist)', actorName: 'Actor Raghava', role: 'Main Villain', notes: 'Gun prop handling certified' }
                ],
                bigSetsAndProps: [
                    'Cliffside Wooden Guardrail',
                    'Leather Gun Holster & Rifle Box',
                    'Antique Gold Pocket Watch'
                ],
                vehicles: [
                    '1972 Land Rover Defender 110'
                ],
                makeupAndCostumes: [
                    'Sweat & Blood FX Touch-up on cheek',
                    'Torn Dark Brown Leather Jacket'
                ],
                stuntsAndSfx: [
                    'Blank Firing Prop Pistol (Clearance Obtained)',
                    'Safety Harness for Cliff Edge'
                ],
                specialEquipment: [
                    'Drone Camera Unit (4K Sunset Tracking)',
                    '200kW Silent Generator Truck'
                ]
            }
        ],
        nearbyHotels: [
            { id: 'h-o1', name: 'Savoy - IHCL SeleQtions Ooty (Cast Stay)', distance: '3.5 km', address: '77, Sylks Road, Ooty', phone: '+91 423 222 3000', rating: 4.8, roomsAvailable: 15 },
            { id: 'h-o2', name: 'Hotel Gem Park Ooty (Crew Stay)', distance: '2.1 km', address: 'Sheddon Road, Ooty', phone: '+91 423 244 1001', rating: 4.2, roomsAvailable: 40 }
        ],
        nearbyHospitals: [
            { id: 'hp-o1', name: 'Government Head Quarters Hospital Ooty', distance: '2.8 km', address: 'Hospital Road, Ooty', phone: '+91 423 244 2212', emergencyType: 'Trauma' },
            { id: 'hp-o2', name: 'Nankem Hospital & ICU Center', distance: '1.9 km', address: 'Coonoor Road, Ooty', phone: '+91 423 244 4000', emergencyType: 'ICU Specialist' }
        ],
        nearbyToilets: [
            { id: 't-o1', name: 'Luxury Vanity Restroom Trailer #1', distance: '50m', type: 'Vanity Trailer Restroom', cleanlinessScore: '9.8/10', description: 'Dual AC washrooms with running hot water' },
            { id: 't-o2', name: 'Forest Park Restroom Complex', distance: '180m', type: 'Permanent Facility', cleanlinessScore: '8.5/10', description: 'Clean public facility' }
        ],
        nearbyChangingDress: [
            { id: 'c-o1', name: 'Vanity Bus Parking Lot A', distance: '60m', type: 'AC Vanity Bus Park', capacity: '4 Full Length Vanity Buses', mirrorsAndSteamers: true },
            { id: 'c-o2', name: 'Wardrobe & Props Tent Complex', distance: '40m', type: 'Wardrobe Tent', capacity: '25 Cast & Crew', mirrorsAndSteamers: true }
        ],
        nearbyPowerSupply: [
            { id: 'p-o1', name: '250kW Super Silent Diesel GenVan', distance: '150m', type: '200kW Silent Diesel Generator', capacity: '250 kW Heavy Load', contactPhone: '+91 98420 11223' }
        ],
        closestEmergency: [
            { id: 'e-o1', name: 'Ooty Fire & Rescue Station', type: 'Fire Station', distance: '2.2 km', phone: '101 / +91 423 244 2099', address: 'ATC Bus Stand Rd' },
            { id: 'e-o2', name: 'Fingerpost Police Station', type: 'Police Patrol Post', distance: '1.1 km', phone: '+91 423 244 2233', address: 'Main Road, Fingerpost' }
        ]
    },
    {
        id: 'loc-chowmahalla',
        scriptLocation: 'CHOWMAHALLA PALACE - HYDERABAD',
        sceneNumbers: ['SCENE 1', 'SCENE 4', 'SCENE 12'],
        realLocationName: 'Chowmahalla Palace (Durbar Hall), Old City, Hyderabad',
        address: '20-4-236, Motigalli, Khilwat, Hyderabad, Telangana 500002',
        googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=Chowmahalla+Palace+Hyderabad',
        coordinates: { lat: 17.3578, lng: 78.4717 },
        status: 'confirmed',
        contactPerson: 'Sultan Ahmed (Palace Administrator)',
        contactPhone: '+91 98490 12345',
        permitStatus: 'Approved',
        dailyRate: '₹1,50,000 / day',
        notes: 'Grand Khilwat Durbar hall approved. Shooting 8 AM to 7 PM only.',
        assignedScenes: [
            {
                sceneNumber: 'SCENE 1',
                slugline: 'INT. VIKRAM PALACE HALL - DAY',
                timeOfDay: 'DAY',
                pageCount: '3 1/8 pgs',
                synopsis: 'The grand royal court assembly where the King announces the succession decree before the council.',
                actors: [
                    { character: 'KING VIKRAMADITYA', actorName: 'Veteran Actor Prakash', role: 'Royal Lead' },
                    { character: 'PRINCE VIKRAM', actorName: 'Actor Vikram', role: 'Lead Prince' },
                    { character: '30 ROYAL GUARDS & COURTIERS', actorName: 'Background Extras', role: 'Extras' }
                ],
                bigSetsAndProps: [
                    'Royal Gold Marble Throne',
                    'Antique Persian Floor Carpets (100ft)',
                    'Custom Brass Sword Display Rack',
                    'Crystal Chandeliers with Warm Lighting'
                ],
                vehicles: [
                    '1948 Vintage Rolls Royce Silver Wraith'
                ],
                makeupAndCostumes: [
                    'Heavy Embroidered Gold Sherwani with Royal Sash',
                    'Diamond Turban Pin & Ceremonial Sword',
                    'Authentic Period Court Costumes'
                ],
                stuntsAndSfx: [
                    'Ceremonial Sword Sparring Stunt Double',
                    'Subtle Atmospheric Haze Machine'
                ],
                specialEquipment: [
                    'Heavy Duty Jib Arm Crane (24ft)',
                    'ARRI Alexa Mini LF Cinema Package'
                ]
            },
            {
                sceneNumber: 'SCENE 4',
                slugline: 'INT. PALACE BANQUET HALL - NIGHT',
                timeOfDay: 'NIGHT',
                pageCount: '2 0/8 pgs',
                synopsis: 'The tense evening dinner where secret negotiations break down amidst celebration.',
                actors: [
                    { character: 'PRINCE VIKRAM', actorName: 'Actor Vikram', role: 'Lead' },
                    { character: 'MEERA', actorName: 'Actress Meera', role: 'Lead Female' }
                ],
                bigSetsAndProps: [
                    '40ft Carved Mahogany Dining Table',
                    'Silver Goblets & Royal Dinnerware Set'
                ],
                vehicles: [
                    'Black Executive Armored Sedan'
                ],
                makeupAndCostumes: [
                    'Royal Silk Saree with Heavy Zardosi Work',
                    'Black Velvet Bandhgala Suit'
                ],
                stuntsAndSfx: [
                    'Candle Flicker Atmosphere'
                ]
            }
        ],
        nearbyHotels: [
            { id: 'h-c1', name: 'Taj Falaknuma Palace (Executive Cast)', distance: '3.2 km', address: 'Engine Bowli, Falaknuma', phone: '+91 40 6629 8585', rating: 4.9, roomsAvailable: 10 },
            { id: 'h-c2', name: 'Hotel Royal Residency (Crew Lodge)', distance: '0.8 km', address: 'Charminar Main Rd', phone: '+91 40 2452 9900', rating: 4.2, roomsAvailable: 35 }
        ],
        nearbyHospitals: [
            { id: 'hp-c1', name: 'Osmania General Hospital (Trauma Center)', distance: '1.4 km', address: 'Afzal Gunj, Hyderabad', phone: '+91 40 2460 0121', emergencyType: 'Trauma' }
        ],
        nearbyToilets: [
            { id: 't-c1', name: 'Palace Courtyard AC Washroom Block', distance: '30m', type: 'Permanent Facility', cleanlinessScore: '9.5/10', description: 'Sanitized marble restrooms' }
        ],
        nearbyChangingDress: [
            { id: 'c-c1', name: 'Courtyard VIP Vanity Bus Park', distance: '50m', type: 'AC Vanity Bus Park', capacity: '3 Full Size Buses', mirrorsAndSteamers: true }
        ],
        nearbyPowerSupply: [
            { id: 'p-c1', name: 'Palace 3-Phase Grid Connection', distance: '40m', type: '3-Phase Grid Connection', capacity: '150 kW Constant', contactPhone: '+91 94400 11223' }
        ],
        closestEmergency: [
            { id: 'e-c1', name: 'Moghalpura Fire Station', type: 'Fire Station', distance: '1.1 km', phone: '101', address: 'Moghalpura, Hyderabad' }
        ]
    },
    {
        id: 'loc-rfc',
        scriptLocation: 'RAMOJI FILM CITY - RAMU VILLAGE',
        sceneNumbers: ['SCENE 3', 'SCENE 8'],
        realLocationName: 'Ramoji Film City (Ramu Village Exterior Set)',
        address: 'Anaspur Village, Hayathnagar Mandal, Hyderabad 501512',
        googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=Ramoji+Film+City+Hyderabad',
        coordinates: { lat: 17.2543, lng: 78.6808 },
        status: 'confirmed',
        contactPerson: 'Venkatesh Rao (RFC Location Manager)',
        contactPhone: '+91 98480 99887',
        permitStatus: 'Approved',
        dailyRate: '₹95,000 / day',
        notes: 'Night shooting approved. Rain machine & fog FX cleared.',
        assignedScenes: [
            {
                sceneNumber: 'SCENE 3',
                slugline: 'EXT. VILLAGE WELL - NIGHT',
                timeOfDay: 'NIGHT',
                pageCount: '2 2/8 pgs',
                synopsis: 'Late night confrontation near the ancient village well amidst sudden heavy rain.',
                actors: [
                    { character: 'VIKRAM', actorName: 'Actor Vikram', role: 'Lead' },
                    { character: 'VILLAGE ELDER', actorName: 'Actor Raghunath', role: 'Supporting' }
                ],
                bigSetsAndProps: [
                    'Ancient Stone Water Well with Pulley',
                    'Wooden Buckets & Clay Pots'
                ],
                vehicles: [
                    'Bullock Cart',
                    'Vintage 1965 Massey Ferguson Tractor'
                ],
                makeupAndCostumes: [
                    'Soaked Rural Cotton Dhoti & Kurta',
                    'Dirt & Rain Wet Makeup'
                ],
                stuntsAndSfx: [
                    'High Pressure Rain Machine Rigging',
                    'Controlled Flame Fire Torches'
                ]
            }
        ],
        nearbyHotels: [
            { id: 'h-r1', name: 'Hotel Sitara (RFC Campus)', distance: '1.5 km', address: 'Film City Campus', phone: '+91 8415 246555', rating: 4.8, roomsAvailable: 20 }
        ],
        nearbyHospitals: [
            { id: 'hp-r1', name: 'RFC Emergency Medical Unit', distance: '0.4 km', address: 'Inside Film City Gate 1', phone: '+91 8415 246108', emergencyType: 'Medical' }
        ],
        nearbyToilets: [
            { id: 't-r1', name: 'Ramu Village Set Permanent Washrooms', distance: '80m', type: 'Permanent Facility', cleanlinessScore: '8.8/10', description: 'Clean tiled toilets' }
        ],
        nearbyChangingDress: [
            { id: 'c-r1', name: 'Village Set Wardrobe Complex', distance: '100m', type: 'Wardrobe Tent', capacity: '30 Extras', mirrorsAndSteamers: true }
        ],
        nearbyPowerSupply: [
            { id: 'p-r1', name: 'RFC Heavy Duty Generator Van #4', distance: '50m', type: '200kW Silent Diesel Generator', capacity: '250 kW', contactPhone: '+91 98480 11122' }
        ],
        closestEmergency: [
            { id: 'e-r1', name: 'RFC Fire Tender Station', type: 'Fire Station', distance: '0.6 km', phone: '+91 8415 246101', address: 'Gate 2 Security' }
        ]
    }
];

export const LocationScoutView: React.FC = () => {
    const { beats } = useProject();
    const [locations, setLocations] = useState<LocationMapping[]>(DEFAULT_LOCATIONS);
    const [selectedLocId, setSelectedLocId] = useState<string>(DEFAULT_LOCATIONS[0].id);
    const [selectedSceneIdx, setSelectedSceneIdx] = useState<number>(0);
    const [searchQuery, setSearchQuery] = useState('');
    
    // Side Overlay / Modal for Double-Click Nearby Logistics Summary
    const [isLogisticsDrawerOpen, setIsLogisticsDrawerOpen] = useState<boolean>(false);
    const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);

    // Form inputs for adding a new mapped location
    const [newScriptLoc, setNewScriptLoc] = useState('');
    const [newRealName, setNewRealName] = useState('');
    const [newAddress, setNewAddress] = useState('');
    const [newContact, setNewContact] = useState('');

    const selectedLoc = useMemo(() => {
        return locations.find(l => l.id === selectedLocId) || locations[0];
    }, [locations, selectedLocId]);

    const currentScene = useMemo(() => {
        if (!selectedLoc.assignedScenes || selectedLoc.assignedScenes.length === 0) {
            return null;
        }
        return selectedLoc.assignedScenes[selectedSceneIdx] || selectedLoc.assignedScenes[0];
    }, [selectedLoc, selectedSceneIdx]);

    const filteredLocations = useMemo(() => {
        if (!searchQuery.trim()) return locations;
        const q = searchQuery.toLowerCase();
        return locations.filter(l => 
            l.scriptLocation.toLowerCase().includes(q) ||
            l.realLocationName.toLowerCase().includes(q) ||
            l.address.toLowerCase().includes(q) ||
            l.assignedScenes.some(s => s.sceneNumber.toLowerCase().includes(q) || s.slugline.toLowerCase().includes(q))
        );
    }, [locations, searchQuery]);

    const handleLocationClick = (locId: string) => {
        setSelectedLocId(locId);
        setSelectedSceneIdx(0);
    };

    const handleLocationDoubleClick = (locId: string) => {
        setSelectedLocId(locId);
        setSelectedSceneIdx(0);
        setIsLogisticsDrawerOpen(true);
    };

    const handleAddLocationSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newScriptLoc || !newRealName) return;

        const newLoc: LocationMapping = {
            id: `loc-${Date.now()}`,
            scriptLocation: newScriptLoc.toUpperCase(),
            sceneNumbers: ['SCENE NEW'],
            realLocationName: newRealName,
            address: newAddress || 'Main Shooting Location Address',
            googleMapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(newRealName + ' ' + newAddress)}`,
            coordinates: { lat: 11.4102, lng: 76.6950 },
            status: 'recce_needed',
            contactPerson: newContact || 'Location Manager',
            contactPhone: '+91 90000 00000',
            permitStatus: 'Pending',
            dailyRate: 'Quote Pending',
            notes: 'Scouting recce required.',
            assignedScenes: [
                {
                    sceneNumber: 'SCENE NEW',
                    slugline: newScriptLoc.toUpperCase(),
                    timeOfDay: 'DAY',
                    synopsis: 'Newly assigned scene location.',
                    actors: [{ character: 'LEAD CHARACTER', actorName: 'Cast Member', role: 'Main Lead' }],
                    bigSetsAndProps: ['Primary Set Piece'],
                    vehicles: ['Production Unit Van'],
                    makeupAndCostumes: ['Character Outfit'],
                    stuntsAndSfx: ['None Required'],
                    specialEquipment: ['Standard Camera Package']
                }
            ],
            nearbyHotels: [
                { id: `h-${Date.now()}`, name: 'Hotel Near Location', distance: '1.5 km', address: newAddress || 'Nearby Road', phone: '+91 90000 00000', rating: 4.2, roomsAvailable: 15 }
            ],
            nearbyHospitals: [
                { id: `hp-${Date.now()}`, name: 'City Emergency Hospital', distance: '2.0 km', address: 'Main Road', phone: '108', emergencyType: 'Medical' }
            ],
            nearbyToilets: [
                { id: `t-${Date.now()}`, name: 'Vanity Washroom Trailer', distance: '40m', type: 'Vanity Trailer Restroom', description: 'Dual flush trailer' }
            ],
            nearbyChangingDress: [
                { id: `c-${Date.now()}`, name: 'Vanity Bus Parking Area', distance: '50m', type: 'AC Vanity Bus Park', capacity: '2 Vanity Buses', mirrorsAndSteamers: true }
            ],
            nearbyPowerSupply: [
                { id: `p-${Date.now()}`, name: '125kW Generator Van', distance: '30m', type: '200kW Silent Diesel Generator', capacity: '125 kW' }
            ],
            closestEmergency: [
                { id: `e-${Date.now()}`, name: 'Local Emergency Medical Unit', type: 'Medical Response & Ambulance', distance: '1.0 km', phone: '108', address: 'Nearest Post' }
            ]
        };

        setLocations(prev => [newLoc, ...prev]);
        setSelectedLocId(newLoc.id);
        setSelectedSceneIdx(0);
        setIsAddModalOpen(false);
        setNewScriptLoc('');
        setNewRealName('');
        setNewAddress('');
    };

    return (
        <div className="w-full h-full bg-[#0A0908] text-[#F2EEE2] flex flex-col font-mono text-xs overflow-hidden select-none">
            
            {/* --- DATA-DENSE DASHBOARD HEADER (SHARP EDGES, ZERO MARGIN) --- */}
            <div className="bg-[#12100C] border-b border-[rgba(242,238,226,0.15)] px-4 py-2 flex items-center justify-between shrink-0 h-12">
                
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 bg-[#E0A339]/20 text-[#E0A339] border border-[#E0A339]/40 px-2.5 py-1 font-bold text-[11px] uppercase tracking-wider">
                        <MapPin size={14} />
                        <span>PRIORITY 1: PLANNING (SCENE vs REAL LOCATION)</span>
                    </div>

                    <div className="hidden lg:flex items-center gap-2 text-[#726A5C] text-[11px]">
                        <span>• Double-click any location card for Nearby Logistics Infrastructure & Google Map</span>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setIsLogisticsDrawerOpen(!isLogisticsDrawerOpen)}
                        className={`px-3 py-1.5 border uppercase font-bold tracking-wider text-[10.5px] flex items-center gap-1.5 cursor-pointer transition-all ${
                            isLogisticsDrawerOpen 
                                ? 'bg-[#E0A339] text-[#221703] border-[#E0A339]' 
                                : 'bg-[#181612] text-[#4FB0A6] border-[#4FB0A6]/40 hover:border-[#4FB0A6]'
                        }`}
                    >
                        <Compass size={13} />
                        <span>Logistics Summary Panel</span>
                    </button>

                    <button
                        onClick={() => setIsAddModalOpen(true)}
                        className="px-3 py-1.5 bg-[#E0A339] text-[#281B05] border border-[#E0A339] font-bold uppercase tracking-wider text-[10.5px] flex items-center gap-1.5 cursor-pointer hover:bg-[#d09329]"
                    >
                        <Plus size={13} />
                        <span>Map Location</span>
                    </button>
                </div>
            </div>

            {/* --- MAIN 3-PANEL FULL SCREEN REAL ESTATE WORKSPACE --- */}
            <div className="flex-1 flex overflow-hidden min-h-0">
                
                {/* PANEL 1: MAPPED LOCATIONS CARDS LIST (LEFT PANEL) */}
                <div className="w-80 bg-[#100E0B] border-r border-[rgba(242,238,226,0.15)] flex flex-col shrink-0 overflow-hidden">
                    
                    {/* Search & Filter Header */}
                    <div className="p-2 bg-[#161410] border-b border-[rgba(242,238,226,0.12)] space-y-1.5">
                        <div className="relative">
                            <Search size={13} className="absolute left-2.5 top-2 text-[#726A5C]" />
                            <input 
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Filter Ooty, Palace, Scene #..."
                                className="w-full pl-8 pr-2 py-1 bg-[#0A0908] border border-[rgba(242,238,226,0.2)] rounded-none text-[11px] text-[#F2EEE2] placeholder-[#726A5C] focus:outline-none focus:border-[#E0A339]"
                            />
                        </div>
                        <div className="flex items-center justify-between text-[9.5px] text-[#726A5C] uppercase tracking-wider px-0.5">
                            <span>{filteredLocations.length} Mapped Locations</span>
                            <span className="text-[#E0A339] font-bold">DbClick = Logistics</span>
                        </div>
                    </div>

                    {/* Cards Scroll View */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-[rgba(242,238,226,0.08)]">
                        {filteredLocations.map(loc => {
                            const isSelected = loc.id === selectedLocId;
                            return (
                                <div
                                    key={loc.id}
                                    onClick={() => handleLocationClick(loc.id)}
                                    onDoubleClick={() => handleLocationDoubleClick(loc.id)}
                                    className={`p-3 border-l-2 transition-all cursor-pointer relative ${
                                        isSelected 
                                            ? 'bg-[#1C1811] border-l-[#E0A339]' 
                                            : 'bg-[#100E0B] border-l-transparent hover:bg-[#161410]'
                                    }`}
                                >
                                    <div className="flex items-center justify-between gap-1">
                                        <span className="text-[10px] font-bold px-1.5 py-0.2 bg-[#E0A339]/20 text-[#E0A339] border border-[#E0A339]/30">
                                            {loc.assignedScenes.length} SCENES
                                        </span>
                                        <span className={`text-[9.5px] font-bold uppercase px-1 py-0.2 ${
                                            loc.permitStatus === 'Approved' ? 'bg-[#5E9E6E]/20 text-[#5E9E6E]' : 'bg-[#C1443A]/20 text-[#C1443A]'
                                        }`}>
                                            {loc.permitStatus}
                                        </span>
                                    </div>

                                    {/* Script Location Name */}
                                    <h3 className="font-bold text-xs text-[#F2EEE2] uppercase tracking-wide mt-1.5">
                                        {loc.scriptLocation}
                                    </h3>

                                    {/* Real Location Name */}
                                    <div className="mt-1 text-[11px] text-[#4FB0A6] font-semibold flex items-center gap-1 truncate">
                                        <MapPin size={11} className="shrink-0" />
                                        <span className="truncate">{loc.realLocationName}</span>
                                    </div>

                                    <div className="text-[10px] text-[#A9A190] truncate mt-0.5">
                                        {loc.address}
                                    </div>

                                    {/* Assigned Scene Numbers */}
                                    <div className="mt-2 flex items-center gap-1 flex-wrap">
                                        {loc.assignedScenes.map((sc, i) => (
                                            <span key={i} className="text-[9px] bg-[#0A0908] px-1 py-0.2 border border-[rgba(242,238,226,0.12)] text-[#E0A339]">
                                                {sc.sceneNumber}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* PANEL 2 & 3: SCENE BREAKDOWN & SIDE LOGISTICS INFRASTRUCTURE */}
                <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0 bg-[#0A0908]">
                    
                    {/* CENTER COLUMN: ASSIGNED SCENES & DETAILED REQUIREMENTS */}
                    <div className="flex-1 flex flex-col overflow-y-auto custom-scrollbar p-3 space-y-3">
                        
                        {/* Selected Location Banner */}
                        <div className="bg-[#14120E] border border-[rgba(242,238,226,0.15)] p-3 flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0">
                            <div>
                                <div className="text-[10px] text-[#E0A339] font-bold uppercase tracking-wider flex items-center gap-1">
                                    <MapPin size={12} />
                                    <span>Selected Script Location</span>
                                </div>
                                <h2 className="text-base font-bold text-[#F2EEE2] uppercase mt-0.5">
                                    {selectedLoc.scriptLocation}
                                </h2>
                                <div className="text-xs text-[#4FB0A6] font-semibold mt-0.5">
                                    📍 Real Location: {selectedLoc.realLocationName}
                                </div>
                            </div>

                            <div className="flex items-center gap-3 font-mono text-[11px]">
                                <a 
                                    href={selectedLoc.googleMapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedLoc.address)}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="px-3 py-1.5 bg-[#1C1A14] border border-[#4FB0A6] text-[#4FB0A6] hover:bg-[#4FB0A6] hover:text-[#0A0908] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer"
                                >
                                    <span>Open Google Map</span>
                                    <ArrowUpRight size={13} />
                                </a>

                                <button
                                    onClick={() => setIsLogisticsDrawerOpen(true)}
                                    className="px-3 py-1.5 bg-[#221D15] border border-[#E0A339] text-[#E0A339] font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer hover:bg-[#E0A339] hover:text-[#281B05] transition-colors"
                                >
                                    <Compass size={13} />
                                    <span>Logistics Summary</span>
                                </button>
                            </div>
                        </div>

                        {/* Assigned Scene Selector Tabs */}
                        <div className="bg-[#100E0B] border border-[rgba(242,238,226,0.15)] p-2">
                            <div className="text-[10px] text-[#726A5C] uppercase font-bold tracking-wider mb-1.5 px-1 flex items-center justify-between">
                                <span>Scenes Assigned to {selectedLoc.scriptLocation}:</span>
                                <span className="text-[#E0A339]">{selectedLoc.assignedScenes.length} Total</span>
                            </div>

                            <div className="flex items-center gap-1 overflow-x-auto custom-scrollbar">
                                {selectedLoc.assignedScenes.map((sc, idx) => {
                                    const isCurrent = idx === selectedSceneIdx;
                                    return (
                                        <button
                                            key={idx}
                                            onClick={() => setSelectedSceneIdx(idx)}
                                            className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider cursor-pointer shrink-0 border transition-all ${
                                                isCurrent 
                                                    ? 'bg-[#E0A339] text-[#221703] border-[#E0A339]' 
                                                    : 'bg-[#181612] text-[#A9A190] border-[rgba(242,238,226,0.12)] hover:text-[#F2EEE2]'
                                            }`}
                                        >
                                            <span>{sc.sceneNumber}</span>
                                            <span className="text-[9.5px] opacity-80 ml-1">({sc.timeOfDay})</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* SCENE REQUIREMENTS SHARP BREAKDOWN GRID */}
                        {currentScene ? (
                            <div className="space-y-3">
                                
                                {/* Scene Title Banner */}
                                <div className="bg-[#14120E] border border-[rgba(242,238,226,0.15)] p-3">
                                    <div className="flex items-center justify-between border-b border-[rgba(242,238,226,0.1)] pb-1.5">
                                        <div className="flex items-center gap-2">
                                            <span className="px-2 py-0.5 bg-[#E0A339] text-[#281B05] font-bold text-xs">
                                                {currentScene.sceneNumber}
                                            </span>
                                            <h3 className="font-bold text-sm text-[#F2EEE2] uppercase">
                                                {currentScene.slugline}
                                            </h3>
                                        </div>
                                        <div className="text-[11px] text-[#E0A339] font-bold">
                                            {currentScene.pageCount || '1 4/8 pgs'}
                                        </div>
                                    </div>
                                    <p className="text-[11px] text-[#A9A190] mt-1.5 italic">
                                        "{currentScene.synopsis}"
                                    </p>
                                </div>

                                {/* 5 SHARP REQUIREMENT CARDS */}
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                                    
                                    {/* 1. ACTORS & CAST */}
                                    <div className="bg-[#12100C] border border-[rgba(242,238,226,0.15)] p-3 space-y-2">
                                        <div className="flex items-center justify-between border-b border-[rgba(242,238,226,0.1)] pb-1 text-xs font-bold text-[#E0A339] uppercase">
                                            <div className="flex items-center gap-1.5">
                                                <Users size={14} />
                                                <span>1. Actors / Cast</span>
                                            </div>
                                            <span className="text-[10px] text-[#726A5C]">{currentScene.actors.length}</span>
                                        </div>

                                        <div className="space-y-1.5">
                                            {currentScene.actors.map((act, i) => (
                                                <div key={i} className="p-2 bg-[#181612] border border-[rgba(242,238,226,0.08)]">
                                                    <div className="font-bold text-[#F2EEE2] flex justify-between text-[11px]">
                                                        <span>{act.character}</span>
                                                        <span className="text-[9.5px] text-[#E0A339]">{act.role}</span>
                                                    </div>
                                                    <div className="text-[10.5px] text-[#4FB0A6] font-semibold mt-0.5">
                                                        Artist: {act.actorName}
                                                    </div>
                                                    {act.notes && (
                                                        <div className="text-[9.5px] text-[#A9A190] mt-0.5 italic">
                                                            {act.notes}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* 2. BIG SETS & PROPS */}
                                    <div className="bg-[#12100C] border border-[rgba(242,238,226,0.15)] p-3 space-y-2">
                                        <div className="flex items-center justify-between border-b border-[rgba(242,238,226,0.1)] pb-1 text-xs font-bold text-[#4FB0A6] uppercase">
                                            <div className="flex items-center gap-1.5">
                                                <PackageCheck size={14} />
                                                <span>2. Big Sets & Props</span>
                                            </div>
                                            <span className="text-[10px] text-[#726A5C]">{currentScene.bigSetsAndProps.length}</span>
                                        </div>

                                        <ul className="space-y-1 text-[11px]">
                                            {currentScene.bigSetsAndProps.map((p, i) => (
                                                <li key={i} className="p-1.5 bg-[#181612] border border-[rgba(242,238,226,0.06)] text-[#F2EEE2] flex items-center gap-1.5">
                                                    <span className="text-[#4FB0A6] font-bold">•</span>
                                                    <span>{p}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>

                                    {/* 3. VEHICLES */}
                                    <div className="bg-[#12100C] border border-[rgba(242,238,226,0.15)] p-3 space-y-2">
                                        <div className="flex items-center justify-between border-b border-[rgba(242,238,226,0.1)] pb-1 text-xs font-bold text-[#E0A339] uppercase">
                                            <div className="flex items-center gap-1.5">
                                                <Car size={14} />
                                                <span>3. Vehicles</span>
                                            </div>
                                            <span className="text-[10px] text-[#726A5C]">{currentScene.vehicles.length}</span>
                                        </div>

                                        <ul className="space-y-1 text-[11px]">
                                            {currentScene.vehicles.map((v, i) => (
                                                <li key={i} className="p-1.5 bg-[#181612] border border-[rgba(242,238,226,0.06)] text-[#F2EEE2] flex items-center gap-1.5">
                                                    <span className="text-[#E0A339]">🚗</span>
                                                    <span>{v}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>

                                    {/* 4. MAKEUP & COSTUMES */}
                                    <div className="bg-[#12100C] border border-[rgba(242,238,226,0.15)] p-3 space-y-2">
                                        <div className="flex items-center justify-between border-b border-[rgba(242,238,226,0.1)] pb-1 text-xs font-bold text-[#C1443A] uppercase">
                                            <div className="flex items-center gap-1.5">
                                                <Scissors size={14} />
                                                <span>4. Makeup & Wardrobe</span>
                                            </div>
                                            <span className="text-[10px] text-[#726A5C]">{currentScene.makeupAndCostumes.length}</span>
                                        </div>

                                        <ul className="space-y-1 text-[11px]">
                                            {currentScene.makeupAndCostumes.map((m, i) => (
                                                <li key={i} className="p-1.5 bg-[#181612] border border-[rgba(242,238,226,0.06)] text-[#F2EEE2] flex items-center gap-1.5">
                                                    <span className="text-[#C1443A]">💄</span>
                                                    <span>{m}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>

                                    {/* 5. STUNTS & SPECIAL CAMERA RIGS */}
                                    <div className="bg-[#12100C] border border-[rgba(242,238,226,0.15)] p-3 space-y-2 md:col-span-2 lg:col-span-2">
                                        <div className="flex items-center justify-between border-b border-[rgba(242,238,226,0.1)] pb-1 text-xs font-bold text-[#5E9E6E] uppercase">
                                            <div className="flex items-center gap-1.5">
                                                <Shield size={14} />
                                                <span>5. Stunts, SFX & Camera Equipment</span>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px]">
                                            <div>
                                                <span className="text-[9.5px] text-[#726A5C] uppercase block mb-1">Stunts & SFX:</span>
                                                <ul className="space-y-1">
                                                    {currentScene.stuntsAndSfx.map((s, i) => (
                                                        <li key={i} className="p-1.5 bg-[#181612] text-[#F2EEE2] flex items-center gap-1.5">
                                                            <span className="text-[#5E9E6E]">⚡</span>
                                                            <span>{s}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>

                                            {currentScene.specialEquipment && (
                                                <div>
                                                    <span className="text-[9.5px] text-[#726A5C] uppercase block mb-1">Camera & Lighting:</span>
                                                    <ul className="space-y-1">
                                                        {currentScene.specialEquipment.map((eq, i) => (
                                                            <li key={i} className="p-1.5 bg-[#181612] text-[#F2EEE2] flex items-center gap-1.5">
                                                                <Video size={12} className="text-[#E0A339]" />
                                                                <span>{eq}</span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                </div>
                            </div>
                        ) : (
                            <div className="p-8 text-center bg-[#14120E] border border-[rgba(242,238,226,0.15)] text-[#A9A190]">
                                No assigned scene requirements found for this location.
                            </div>
                        )}
                    </div>

                    {/* RIGHT DRAWER / SIDE SUMMARY CARD: NEARBY LOGISTICS INFRASTRUCTURE */}
                    {isLogisticsDrawerOpen && (
                        <div className="w-full lg:w-96 bg-[#12100C] border-t lg:border-t-0 lg:border-l border-[rgba(242,238,226,0.15)] flex flex-col shrink-0 overflow-hidden">
                            
                            {/* Drawer Header */}
                            <div className="p-3 bg-[#181612] border-b border-[rgba(242,238,226,0.15)] flex items-center justify-between shrink-0">
                                <div className="flex items-center gap-2 text-[#E0A339] font-bold text-xs uppercase">
                                    <Compass size={15} />
                                    <span>Logistics Infrastructure Summary</span>
                                </div>
                                <button
                                    onClick={() => setIsLogisticsDrawerOpen(false)}
                                    className="text-[#A9A190] hover:text-[#F2EEE2] cursor-pointer"
                                >
                                    <X size={16} />
                                </button>
                            </div>

                            {/* Logistics Content */}
                            <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-4">
                                
                                {/* Location & Google Map Link */}
                                <div className="p-3 bg-[#181612] border border-[rgba(242,238,226,0.12)] space-y-2">
                                    <div className="text-[10px] text-[#726A5C] uppercase font-bold">Selected Real Location</div>
                                    <div className="text-xs font-bold text-[#F2EEE2]">{selectedLoc.realLocationName}</div>
                                    <div className="text-[10.5px] text-[#A9A190]">{selectedLoc.address}</div>

                                    <a
                                        href={selectedLoc.googleMapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedLoc.address)}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="mt-2 w-full py-2 bg-[#E0A339] text-[#281B05] font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-[#d09329] transition-colors"
                                    >
                                        <MapIcon size={14} />
                                        <span>Open Google Location Link</span>
                                        <ExternalLink size={13} />
                                    </a>
                                </div>

                                {/* Hotels & Stays */}
                                <div className="space-y-1.5">
                                    <div className="text-[10.5px] text-[#E0A339] font-bold uppercase flex items-center gap-1.5">
                                        <Building size={13} />
                                        <span>Nearby Hotels & Accommodation</span>
                                    </div>
                                    {selectedLoc.nearbyHotels.map(h => (
                                        <div key={h.id} className="p-2 bg-[#181612] border border-[rgba(242,238,226,0.08)] space-y-0.5">
                                            <div className="flex justify-between font-bold text-[#F2EEE2]">
                                                <span>{h.name}</span>
                                                <span className="text-[#5E9E6E]">{h.distance}</span>
                                            </div>
                                            <div className="text-[10px] text-[#A9A190]">{h.address} • Ph: {h.phone}</div>
                                            <div className="text-[9.5px] text-[#E0A339]">★ {h.rating} — {h.roomsAvailable} Rooms Available</div>
                                        </div>
                                    ))}
                                </div>

                                {/* Hospitals */}
                                <div className="space-y-1.5">
                                    <div className="text-[10.5px] text-[#C1443A] font-bold uppercase flex items-center gap-1.5">
                                        <Hospital size={13} />
                                        <span>Nearby Hospitals & Medical Emergency</span>
                                    </div>
                                    {selectedLoc.nearbyHospitals.map(hp => (
                                        <div key={hp.id} className="p-2 bg-[#181612] border border-[rgba(242,238,226,0.08)] space-y-0.5">
                                            <div className="flex justify-between font-bold text-[#F2EEE2]">
                                                <span>{hp.name}</span>
                                                <span className="text-[#C1443A]">{hp.distance}</span>
                                            </div>
                                            <div className="text-[10px] text-[#A9A190]">{hp.address} • Emergency: {hp.phone}</div>
                                            <div className="text-[9.5px] text-[#C1443A] font-bold">{hp.emergencyType}</div>
                                        </div>
                                    ))}
                                </div>

                                {/* Vanity Toilets & Changing Rooms */}
                                <div className="space-y-1.5">
                                    <div className="text-[10.5px] text-[#4FB0A6] font-bold uppercase flex items-center gap-1.5">
                                        <Users size={13} />
                                        <span>Vanity Restrooms & Changing Rooms</span>
                                    </div>
                                    {selectedLoc.nearbyToilets.map(t => (
                                        <div key={t.id} className="p-2 bg-[#181612] border border-[rgba(242,238,226,0.08)] space-y-0.5">
                                            <div className="flex justify-between font-bold text-[#F2EEE2]">
                                                <span>{t.name}</span>
                                                <span className="text-[#4FB0A6]">{t.distance}</span>
                                            </div>
                                            <div className="text-[10px] text-[#A9A190]">{t.type} — Cleanliness: {t.cleanlinessScore}</div>
                                        </div>
                                    ))}
                                    {selectedLoc.nearbyChangingDress.map(c => (
                                        <div key={c.id} className="p-2 bg-[#181612] border border-[rgba(242,238,226,0.08)] space-y-0.5">
                                            <div className="flex justify-between font-bold text-[#F2EEE2]">
                                                <span>{c.name}</span>
                                                <span className="text-[#4FB0A6]">{c.distance}</span>
                                            </div>
                                            <div className="text-[10px] text-[#A9A190]">Cap: {c.capacity}</div>
                                        </div>
                                    ))}
                                </div>

                                {/* Power Generators */}
                                <div className="space-y-1.5">
                                    <div className="text-[10.5px] text-[#E0A339] font-bold uppercase flex items-center gap-1.5">
                                        <Zap size={13} />
                                        <span>Power Generators & Electricity Grid</span>
                                    </div>
                                    {selectedLoc.nearbyPowerSupply.map(p => (
                                        <div key={p.id} className="p-2 bg-[#181612] border border-[rgba(242,238,226,0.08)] space-y-0.5">
                                            <div className="flex justify-between font-bold text-[#F2EEE2]">
                                                <span>{p.name}</span>
                                                <span className="text-[#E0A339]">{p.distance}</span>
                                            </div>
                                            <div className="text-[10px] text-[#A9A190]">{p.type} — Load: {p.capacity}</div>
                                        </div>
                                    ))}
                                </div>

                                {/* Closest Emergency / Police / Fire */}
                                <div className="space-y-1.5">
                                    <div className="text-[10.5px] text-[#5E9E6E] font-bold uppercase flex items-center gap-1.5">
                                        <ShieldAlert size={13} />
                                        <span>Fire & Police Station Emergency</span>
                                    </div>
                                    {selectedLoc.closestEmergency.map(e => (
                                        <div key={e.id} className="p-2 bg-[#181612] border border-[rgba(242,238,226,0.08)] space-y-0.5">
                                            <div className="flex justify-between font-bold text-[#F2EEE2]">
                                                <span>{e.name}</span>
                                                <span className="text-[#5E9E6E]">{e.distance}</span>
                                            </div>
                                            <div className="text-[10px] text-[#A9A190]">{e.address} • Ph: {e.phone}</div>
                                        </div>
                                    ))}
                                </div>

                            </div>
                        </div>
                    )}

                </div>
            </div>

            {/* MAP REAL LOCATION MODAL */}
            {isAddModalOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 z-50">
                    <div className="bg-[#14120E] border border-[#E0A339] w-full max-w-md p-4 space-y-4 shadow-2xl">
                        <div className="flex items-center justify-between border-b border-[rgba(242,238,226,0.15)] pb-2">
                            <h3 className="font-bold text-sm text-[#F2EEE2] uppercase">Map Real Shooting Location</h3>
                            <button onClick={() => setIsAddModalOpen(false)} className="text-[#A9A190] hover:text-[#F2EEE2]">
                                <X size={16} />
                            </button>
                        </div>

                        <form onSubmit={handleAddLocationSubmit} className="space-y-3">
                            <div>
                                <label className="text-[10px] text-[#726A5C] uppercase block mb-1">Script Location Name (e.g. OOTY LAKE)</label>
                                <input 
                                    type="text" 
                                    required
                                    value={newScriptLoc} 
                                    onChange={e => setNewScriptLoc(e.target.value)}
                                    placeholder="e.g. EXT. OOTY TEA GARDEN"
                                    className="w-full p-2 bg-[#0A0908] border border-[rgba(242,238,226,0.2)] text-xs text-[#F2EEE2] focus:border-[#E0A339] outline-none"
                                />
                            </div>

                            <div>
                                <label className="text-[10px] text-[#726A5C] uppercase block mb-1">Real Location Name</label>
                                <input 
                                    type="text" 
                                    required
                                    value={newRealName} 
                                    onChange={e => setNewRealName(e.target.value)}
                                    placeholder="e.g. Doddabetta Tea Estate, Ooty"
                                    className="w-full p-2 bg-[#0A0908] border border-[rgba(242,238,226,0.2)] text-xs text-[#F2EEE2] focus:border-[#E0A339] outline-none"
                                />
                            </div>

                            <div>
                                <label className="text-[10px] text-[#726A5C] uppercase block mb-1">Full Postal Address</label>
                                <input 
                                    type="text" 
                                    value={newAddress} 
                                    onChange={e => setNewAddress(e.target.value)}
                                    placeholder="Address for Google Maps"
                                    className="w-full p-2 bg-[#0A0908] border border-[rgba(242,238,226,0.2)] text-xs text-[#F2EEE2] focus:border-[#E0A339] outline-none"
                                />
                            </div>

                            <div>
                                <label className="text-[10px] text-[#726A5C] uppercase block mb-1">Contact Person / Phone</label>
                                <input 
                                    type="text" 
                                    value={newContact} 
                                    onChange={e => setNewContact(e.target.value)}
                                    placeholder="Estate Manager (+91 90000 00000)"
                                    className="w-full p-2 bg-[#0A0908] border border-[rgba(242,238,226,0.2)] text-xs text-[#F2EEE2] focus:border-[#E0A339] outline-none"
                                />
                            </div>

                            <div className="flex justify-end gap-2 pt-2 border-t border-[rgba(242,238,226,0.1)]">
                                <button
                                    type="button"
                                    onClick={() => setIsAddModalOpen(false)}
                                    className="px-3 py-1.5 border border-[rgba(242,238,226,0.2)] text-[#A9A190] uppercase text-xs"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-1.5 bg-[#E0A339] text-[#281B05] font-bold uppercase text-xs hover:bg-[#d09329]"
                                >
                                    Save Mapping
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

        </div>
    );
};

export default LocationScoutView;
