# Treatment Selector / Injection Mapping System

> **Document Purpose**: Comprehensive technical specification for the interactive anatomical treatment mapping system for Nurse Mel's aesthetic practice.

**Last Updated**: April 21, 2026
**Status**: Planning Phase - Ready for Implementation
**Applies To**: packages/app/src/treatment-map

---

## Table of Contents

1. [Overview](#overview)
2. [User Requirements](#user-requirements)
3. [Architecture](#architecture)
4. [Data Models](#data-models)
5. [FHIR Extensions](#fhir-extensions)
6. [Zone Definitions](#zone-definitions)
7. [Component Specifications](#component-specifications)
8. [User Flows](#user-flows)
9. [Implementation Phases](#implementation-phases)
10. [Role-Based Access](#role-based-access)

---

## Overview

### Problem Statement
Currently, Mel documents Botox treatments by drawing injection points on an iPad using Apple Pencil. This manual process:
- Cannot be easily referenced in future appointments
- Is not searchable or reportable
- Cannot be shared with other providers
- Is not integrated with patient records

### Solution
A digital treatment mapping system that:
- Uploads patient's actual photo (face, torso, etc.)
- Allows precise marking of injection points on the photo
- Records units, product, notes per injection
- Stores in FHIR for permanent record
- Enables reproducibility of treatments
- Can be viewed historically

### Scope
- **Phase 1 (Now)**: Face (front view + profile view)
- **Phase 2 (Later)**: Torso (front/back), Lower (front/back)
- **Design**: Extensible architecture supporting all body regions

---

## User Requirements

### Granularity
- **VERY DETAILED**: Down to individual injection points
- **Muscle group level**: Corrugator, frontalis left/center/right
- **Crows feet**: Outer, middle, inner per side
- **Exact location tracking**: Slightly lower/higher/left variations
- **Injection angle**: Documented for reproducibility

### Visual Design
- **Photo-based**: Upload patient's actual photo
- **Style**: Simple, clean, modern aesthetic
- **Layout**: Full width diagram
- **Color coding**: By units or by product

### Data Entry
- **One zone at a time**: Sequential selection
- **No typical units**: Forces careful, intentional documentation
- **Per-zone product selection**: Supports multiple products per visit
- **Notes per injection**: Angle, exact location details

### Treatment History
- Each past treatment has **openable diagram**
- View injection points from previous sessions
- Compare before/after photos with injection maps

---

## Architecture

### File Structure

```
packages/app/src/treatment-map/
├── components/
│   ├── TreatmentMap.tsx              # Main container component
│   ├── BodyRegionSelector.tsx         # Face/Torso/Lower tabs
│   ├── PhotoUploadZone.tsx            # Patient photo upload
│   ├── PhotoCanvas.tsx                # Canvas with injection markers
│   ├── InjectionMarker.tsx            # Individual marker component
│   ├── ZoneEntryPopup.tsx             # Data entry modal
│   ├── ZoneList.tsx                   # Sidebar list of markers
│   ├── TreatmentSummary.tsx           # Totals & save button
│   ├── HistoricalTreatmentList.tsx    # Past treatments accordion
│   └── HistoricalDiagram.tsx          # Read-only past treatment view
├── hooks/
│   ├── useInjectionMap.ts             # State management hook
│   └── useTreatmentHistory.ts         # Load/save treatments
├── types/
│   └── injection.ts                   # TypeScript interfaces
├── utils/
│   ├── fhir-extensions.ts            # FHIR extension helpers
│   └── zone-config.ts                 # Zone definitions
└── config/
    └── zones.ts                       # Zone definitions by region
```

### Technology Stack
- **React** + **TypeScript**
- **Mantine** UI components
- **Canvas API** for photo marking
- **@medplum/react** for FHIR operations
- **SVG** for zone overlays (optional layer)

---

## Data Models

### TypeScript Interfaces

```typescript
// Main treatment map data
export interface InjectionMap {
  id?: string;                          // Resource ID (for existing)
  bodyRegion: BodyRegion;               // 'face', 'torso', 'lower'
  view: ViewAngle;                      // 'front', 'back', 'left', 'right', 'profile'
  patientPhoto: Attachment;             // The uploaded patient photo
  markers: InjectionMarker[];           // All injection points
  createdAt: string;                    // ISO timestamp
  createdBy: Reference<Practitioner>;  // Provider who documented
}

// Body regions (extensible)
export type BodyRegion = 'face' | 'torso' | 'lower';

// View angles per region
export type ViewAngle = 'front' | 'back' | 'left' | 'right' | 'profile';

// Individual injection marker
export interface InjectionMarker {
  id: string;                           // Unique marker ID
  zoneId: string;                       // Reference to zone definition
  zoneName: string;                     // Human-readable zone name
  
  // Position on photo (0-1 normalized coordinates)
  position: {
    x: number;                          // 0 = left, 1 = right
    y: number;                          // 0 = top, 1 = bottom
  };
  
  // Treatment details
  productBrand: string;                 // Botox, Dysport, Xeomin, etc.
  units: number;                        // Units injected
  
  // Clinical notes
  notes?: string;                       // Angle, depth, technique, etc.
  
  // Optional: predefined zone vs free placement
  isPredefinedZone: boolean;            // true = snapped to zone, false = custom placement
}

// Zone definition (configuration)
export interface ZoneDefinition {
  id: string;                           // e.g., "forehead_center"
  name: string;                         // e.g., "Forehead (Center)"
  bodyRegion: BodyRegion;
  view: ViewAngle;
  
  // Zone boundaries (for snapping)
  bounds: {
    x: number;                          // Center X (normalized)
    y: number;                          // Center Y (normalized)
    radius: number;                     // Snap radius (normalized)
  };
  
  // For muscle-level documentation
  muscleGroup?: string;                 // e.g., "frontalis"
  side?: 'left' | 'center' | 'right';   // For bilateral structures
}

// Complete treatment record (combines with FHIR Procedure)
export interface TreatmentRecord {
  procedure: Procedure;                 // FHIR Procedure
  injectionMap: InjectionMap;           // Our custom data
  beforePhotos: Media[];                // Before treatment photos
  afterPhotos: Media[];                 // After treatment photos
}
```

---

## FHIR Extensions

### Extension Structure

The injection map is stored as a FHIR extension on the **Procedure** resource:

```typescript
// Extension URL
const EXTENSION_URL = 'http://melissaknudson.com/fhir/StructureDefinition/injection-map';

// Extension structure (follows FHIR extension pattern)
{
  "resourceType": "Procedure",
  "id": "treatment-001",
  "status": "completed",
  "code": {
    "coding": [{
      "system": "http://melissaknudson.com/treatments",
      "code": "botox-cosmetic",
      "display": "Botox Cosmetic Treatment"
    }]
  },
  "subject": { "reference": "Patient/patient-001" },
  "performedDateTime": "2024-05-15T14:30:00Z",
  "extension": [{
    "url": "http://melissaknudson.com/fhir/StructureDefinition/injection-map",
    "extension": [
      { "url": "bodyRegion", "valueString": "face" },
      { "url": "view", "valueString": "front" },
      { "url": "patientPhoto", "valueAttachment": {
        "contentType": "image/jpeg",
        "url": "Binary/photo-001"
      }},
      { "url": "marker", "extension": [
        { "url": "zoneId", "valueString": "forehead_center" },
        { "url": "zoneName", "valueString": "Forehead (Center)" },
        { "url": "x", "valueDecimal": 0.5 },
        { "url": "y", "valueDecimal": 0.25 },
        { "url": "productBrand", "valueString": "botox_cosmetic" },
        { "url": "units", "valueInteger": 8 },
        { "url": "notes", "valueString": "45 degree angle, superficial" }
      ]},
      { "url": "marker", "extension": [
        { "url": "zoneId", "valueString": "crow_feet_left_outer" },
        { "url": "zoneName", "valueString": "Crow's Feet (Left Outer)" },
        { "url": "x", "valueDecimal": 0.2 },
        { "url": "y", "valueDecimal": 0.4 },
        { "url": "productBrand", "valueString": "dysport" },
        { "url": "units", "valueInteger": 6 },
        { "url": "notes", "valueString": "Deeper injection" }
      ]}
    ]
  }]
}
```

### Why FHIR Extensions?

- **Standard FHIR pattern**: Follows FHIR R4 extension specification
- **Queryable**: Can search by extension values
- **Type-safe**: Each value has explicit type (valueString, valueInteger, etc.)
- **Extensible**: Easy to add new fields
- **Reversible**: Can reconstruct full injection map from FHIR data

---

## Zone Definitions

### Phase 1: Face Zones (Front View)

```typescript
export const FACE_ZONES_FRONT: ZoneDefinition[] = [
  // Forehead
  { id: 'forehead_left', name: 'Forehead (Left)', bodyRegion: 'face', view: 'front',
    bounds: { x: 0.35, y: 0.20, radius: 0.08 }, muscleGroup: 'frontalis', side: 'left' },
  { id: 'forehead_center', name: 'Forehead (Center)', bodyRegion: 'face', view: 'front',
    bounds: { x: 0.50, y: 0.20, radius: 0.08 }, muscleGroup: 'frontalis', side: 'center' },
  { id: 'forehead_right', name: 'Forehead (Right)', bodyRegion: 'face', view: 'front',
    bounds: { x: 0.65, y: 0.20, radius: 0.08 }, muscleGroup: 'frontalis', side: 'right' },
  
  // Glabella (11s)
  { id: 'glabella_left', name: "Glabella (Left/'11s')", bodyRegion: 'face', view: 'front',
    bounds: { x: 0.45, y: 0.35, radius: 0.06 }, muscleGroup: 'corrugator', side: 'left' },
  { id: 'glabella_right', name: "Glabella (Right/'11s')", bodyRegion: 'face', view: 'front',
    bounds: { x: 0.55, y: 0.35, radius: 0.06 }, muscleGroup: 'corrugator', side: 'right' },
  
  // Crow's Feet (Detailed - 3 zones per side)
  { id: 'crow_feet_left_outer', name: "Crow's Feet (Left Outer)", bodyRegion: 'face', view: 'front',
    bounds: { x: 0.15, y: 0.42, radius: 0.05 }, muscleGroup: 'orbicularis_oculi', side: 'left' },
  { id: 'crow_feet_left_middle', name: "Crow's Feet (Left Middle)", bodyRegion: 'face', view: 'front',
    bounds: { x: 0.20, y: 0.40, radius: 0.05 }, muscleGroup: 'orbicularis_oculi', side: 'left' },
  { id: 'crow_feet_left_inner', name: "Crow's Feet (Left Inner)", bodyRegion: 'face', view: 'front',
    bounds: { x: 0.25, y: 0.38, radius: 0.05 }, muscleGroup: 'orbicularis_oculi', side: 'left' },
  
  { id: 'crow_feet_right_outer', name: "Crow's Feet (Right Outer)", bodyRegion: 'face', view: 'front',
    bounds: { x: 0.85, y: 0.42, radius: 0.05 }, muscleGroup: 'orbicularis_oculi', side: 'right' },
  { id: 'crow_feet_right_middle', name: "Crow's Feet (Right Middle)", bodyRegion: 'face', view: 'front',
    bounds: { x: 0.80, y: 0.40, radius: 0.05 }, muscleGroup: 'orbicularis_oculi', side: 'right' },
  { id: 'crow_feet_right_inner', name: "Crow's Feet (Right Inner)", bodyRegion: 'face', view: 'front',
    bounds: { x: 0.75, y: 0.38, radius: 0.05 }, muscleGroup: 'orbicularis_oculi', side: 'right' },
  
  // Brow Lift
  { id: 'brow_lift_left', name: 'Brow Lift (Left)', bodyRegion: 'face', view: 'front',
    bounds: { x: 0.25, y: 0.35, radius: 0.05 }, muscleGroup: 'frontalis', side: 'left' },
  { id: 'brow_lift_right', name: 'Brow Lift (Right)', bodyRegion: 'face', view: 'front',
    bounds: { x: 0.75, y: 0.35, radius: 0.05 }, muscleGroup: 'frontalis', side: 'right' },
  
  // Bunny Lines
  { id: 'bunny_lines_left', name: 'Bunny Lines (Left)', bodyRegion: 'face', view: 'front',
    bounds: { x: 0.46, y: 0.45, radius: 0.04 }, muscleGroup: 'nasalis', side: 'left' },
  { id: 'bunny_lines_right', name: 'Bunny Lines (Right)', bodyRegion: 'face', view: 'front',
    bounds: { x: 0.54, y: 0.45, radius: 0.04 }, muscleGroup: 'nasalis', side: 'right' },
  
  // Lip Flip
  { id: 'lip_flip_upper_left', name: 'Lip Flip Upper (Left)', bodyRegion: 'face', view: 'front',
    bounds: { x: 0.45, y: 0.65, radius: 0.04 }, muscleGroup: 'orbicularis_oris', side: 'left' },
  { id: 'lip_flip_upper_right', name: 'Lip Flip Upper (Right)', bodyRegion: 'face', view: 'front',
    bounds: { x: 0.55, y: 0.65, radius: 0.04 }, muscleGroup: 'orbicularis_oris', side: 'right' },
  { id: 'lip_flip_lower_left', name: 'Lip Flip Lower (Left)', bodyRegion: 'face', view: 'front',
    bounds: { x: 0.45, y: 0.72, radius: 0.04 }, muscleGroup: 'orbicularis_oris', side: 'left' },
  { id: 'lip_flip_lower_right', name: 'Lip Flip Lower (Right)', bodyRegion: 'face', view: 'front',
    bounds: { x: 0.55, y: 0.72, radius: 0.04 }, muscleGroup: 'orbicularis_oris', side: 'right' },
  
  // Masseter
  { id: 'masseter_left', name: 'Masseter (Left)', bodyRegion: 'face', view: 'front',
    bounds: { x: 0.25, y: 0.60, radius: 0.08 }, muscleGroup: 'masseter', side: 'left' },
  { id: 'masseter_right', name: 'Masseter (Right)', bodyRegion: 'face', view: 'front',
    bounds: { x: 0.75, y: 0.60, radius: 0.08 }, muscleGroup: 'masseter', side: 'right' },
  
  // DAO (Depressor Anguli Oris)
  { id: 'dao_left', name: 'DAO - Marionette Lines (Left)', bodyRegion: 'face', view: 'front',
    bounds: { x: 0.38, y: 0.75, radius: 0.05 }, muscleGroup: 'depressor_anguli_oris', side: 'left' },
  { id: 'dao_right', name: 'DAO - Marionette Lines (Right)', bodyRegion: 'face', view: 'front',
    bounds: { x: 0.62, y: 0.75, radius: 0.05 }, muscleGroup: 'depressor_anguli_oris', side: 'right' },
  
  // Mentalis (Chin)
  { id: 'mentalis_center', name: 'Mentalis - Chin Dimple', bodyRegion: 'face', view: 'front',
    bounds: { x: 0.50, y: 0.82, radius: 0.06 }, muscleGroup: 'mentalis', side: 'center' },
  
  // Platysma (Neck - visible on face view)
  { id: 'platysma_bands_left', name: 'Platysma Bands (Left)', bodyRegion: 'face', view: 'front',
    bounds: { x: 0.35, y: 0.90, radius: 0.06 }, muscleGroup: 'platysma', side: 'left' },
  { id: 'platysma_bands_right', name: 'Platysma Bands (Right)', bodyRegion: 'face', view: 'front',
    bounds: { x: 0.65, y: 0.90, radius: 0.06 }, muscleGroup: 'platysma', side: 'right' },
  
  // Free-form markers (custom placement)
  { id: 'custom', name: 'Custom Location', bodyRegion: 'face', view: 'front',
    bounds: { x: 0.5, y: 0.5, radius: 1.0 }, muscleGroup: 'custom', side: 'center' },
];
```

### Phase 2: Face Profile View

For fillers and profile-specific treatments:

```typescript
export const FACE_ZONES_PROFILE: ZoneDefinition[] = [
  // Cheek augmentation
  { id: 'cheek_profile_upper', name: 'Cheek (Upper)', bodyRegion: 'face', view: 'profile',
    bounds: { x: 0.7, y: 0.45, radius: 0.08 }, muscleGroup: 'zygomaticus' },
  { id: 'cheek_profile_lower', name: 'Cheek (Lower)', bodyRegion: 'face', view: 'profile',
    bounds: { x: 0.65, y: 0.55, radius: 0.08 }, muscleGroup: 'zygomaticus' },
  
  // Jawline
  { id: 'jawline_angle', name: 'Jawline Angle', bodyRegion: 'face', view: 'profile',
    bounds: { x: 0.75, y: 0.70, radius: 0.06 }, muscleGroup: 'masseter' },
  
  // Chin
  { id: 'chin_profile', name: 'Chin (Profile)', bodyRegion: 'face', view: 'profile',
    bounds: { x: 0.85, y: 0.78, radius: 0.06 }, muscleGroup: 'mentalis' },
  
  // Temple
  { id: 'temple_hollow', name: 'Temple Hollow', bodyRegion: 'face', view: 'profile',
    bounds: { x: 0.45, y: 0.25, radius: 0.06 }, muscleGroup: 'temporalis' },
];
```

### Zone Coordinate System

- **Origin**: Top-left corner (0, 0)
- **X-axis**: Left to right (0 = left edge, 1 = right edge)
- **Y-axis**: Top to bottom (0 = top edge, 1 = bottom edge)
- **Snap radius**: Distance from zone center to snap to zone (normalized)

---

## Component Specifications

### 1. TreatmentMap (Main Container)

```typescript
interface TreatmentMapProps {
  patientId: string;                    // Patient being treated
  mode: 'create' | 'view';              // Create new or view existing
  existingProcedure?: Procedure;        // For view mode
}

// State management
- bodyRegion: BodyRegion
- view: ViewAngle
- patientPhoto: File | Attachment | null
- markers: InjectionMarker[]
- selectedMarker: InjectionMarker | null
- isSaving: boolean
```

### 2. PhotoUploadZone

```typescript
interface PhotoUploadZoneProps {
  onPhotoUpload: (file: File) => void;
  existingPhoto?: Attachment;
}

// Features
- Drag & drop support
- Camera capture (on tablets)
- Preview uploaded photo
- Aspect ratio guidance (portrait recommended)
```

### 3. PhotoCanvas

```typescript
interface PhotoCanvasProps {
  photoUrl: string;
  markers: InjectionMarker[];
  zones: ZoneDefinition[];
  onCanvasClick: (x: number, y: number) => void;
  onMarkerClick: (marker: InjectionMarker) => void;
  readOnly: boolean;
}

// Features
- Display photo
- Render markers as colored dots
- Render zone overlays (optional)
- Click to place new marker
- Click marker to edit
- Color coding:
  - By product: Different colors per product
  - By units: Gradient from green (low) to red (high)
```

### 4. ZoneEntryPopup

```typescript
interface ZoneEntryPopupProps {
  isOpen: boolean;
  marker: InjectionMarker | null;
  onSave: (marker: InjectionMarker) => void;
  onDelete: (markerId: string) => void;
  onClose: () => void;
}

// Form fields
- Zone name (display only or editable)
- Product brand: Select dropdown
  - Botox Cosmetic
  - Dysport
  - Xeomin
  - Jeuveau
- Units: Number input (no typical range)
- Notes: Textarea for angle, depth, technique
```

### 5. ZoneList (Sidebar)

```typescript
interface ZoneListProps {
  markers: InjectionMarker[];
  onMarkerSelect: (marker: InjectionMarker) => void;
  onMarkerDelete: (markerId: string) => void;
}

// Features
- List all markers
- Show zone name + units + product
- Click to select/highlight on canvas
- Delete button per marker
- Group by muscle group or zone
- Show total units per product
```

### 6. TreatmentSummary

```typescript
interface TreatmentSummaryProps {
  markers: InjectionMarker[];
  onSave: () => void;
  onCancel: () => void;
  isSaving: boolean;
}

// Features
- Total units per product
- Total markers
- Save button
- Cancel button
- Validation (at least one marker required)
```

### 7. HistoricalTreatmentList

```typescript
interface HistoricalTreatmentListProps {
  patientId: string;
  onTreatmentSelect: (procedure: Procedure) => void;
}

// Features
- Accordion list of past treatments
- Date, provider, total units
- Expand to see diagram
- Compare treatments
```

### 8. HistoricalDiagram

```typescript
interface HistoricalDiagramProps {
  procedure: Procedure;
}

// Features
- Read-only view
- Shows injection points
- Shows units per point
- Cannot edit
```

---

## User Flows

### Flow 1: Document New Treatment

1. **Provider opens BotoxTreatmentPage**
   - Sees patient header
   - Sees "New Treatment" button

2. **Clicks "New Treatment"**
   - Selects body region (Face/Torso/Lower) - default Face
   - Selects view (Front/Profile) - default Front
   - Uploads patient photo (or uses existing)

3. **Canvas appears**
   - Provider clicks on photo where injection was given
   - Snap to nearest zone (if within radius)
   - Or creates custom marker

4. **ZoneEntryPopup opens**
   - Shows zone name (or "Custom")
   - Provider selects product
   - Enters units
   - Enters notes (angle, depth, etc.)
   - Clicks "Save Marker"

5. **Marker appears on canvas**
   - Color-coded by product or units
   - Listed in sidebar

6. **Repeat for all injections**
   - Multiple markers per zone allowed
   - Different products per zone allowed

7. **Review sidebar**
   - See all markers
   - See total units per product
   - Can edit or delete markers

8. **Click "Save Treatment"**
   - Creates Procedure resource
   - Creates InjectionMap extension
   - Creates Media resources for before/after photos
   - Shows success notification
   - Returns to treatment history view

### Flow 2: View Treatment History

1. **Provider scrolls to history**
   - Sees list of past treatments
   - Date, provider, total units

2. **Clicks on treatment**
   - Expands accordion
   - Shows read-only diagram
   - Shows injection points with units
   - Shows before/after photos
   - Shows notes per injection

3. **Close accordion**
   - Returns to list view

---

## Implementation Phases

### Phase 1: Core Face Front (MVP)

**Week 1: Setup & Types**
- [ ] Create directory structure
- [ ] Define TypeScript interfaces
- [ ] Define FHIR extension structure
- [ ] Create zone config for face front

**Week 2: Components**
- [ ] TreatmentMap container
- [ ] PhotoUploadZone
- [ ] PhotoCanvas with click handling
- [ ] ZoneEntryPopup
- [ ] ZoneList sidebar
- [ ] TreatmentSummary

**Week 3: Integration**
- [ ] Integrate with BotoxTreatmentPage
- [ ] Load/save to FHIR
- [ ] Create Procedure with extension
- [ ] Test end-to-end

**Week 4: Polish**
- [ ] Color coding
- [ ] Error handling
- [ ] Loading states
- [ ] Role-based access

### Phase 2: Face Profile

- [ ] Create profile zone config
- [ ] Add view selector (front/profile)
- [ ] Profile-specific zones

### Phase 3: Torso & Lower

- [ ] Design torso diagrams
- [ ] Design lower diagrams
- [ ] Create zone configs
- [ ] Extend BodyRegionSelector

### Phase 4: Advanced Features

- [ ] Historical diagram comparison
- [ ] Print/export injection maps
- [ ] Analytics (average units per zone)
- [ ] Provider comparison

---

## Role-Based Access

### Provider (Full Access)
- Create new treatments
- Edit/delete markers
- Save treatments
- View history
- View full diagrams

### Coordinator (Read-Only)
- View treatment history
- View diagrams (read-only)
- Cannot create/edit
- Cannot see clinical notes (optional - configurable)

### Implementation

```typescript
// In TreatmentMap component
const role = getMedSpaRole(medplum);
const isReadOnly = role === 'coordinator';

// Pass to child components
<PhotoCanvas readOnly={isReadOnly} />
<ZoneList readOnly={isReadOnly} />

// Hide save button for coordinators
{!isReadOnly && <TreatmentSummary ... />}
```

---

## Technical Notes

### Canvas Implementation

```typescript
// Click to place marker
const handleCanvasClick = (e: MouseEvent) => {
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) / rect.width;
  const y = (e.clientY - rect.top) / rect.height;
  
  // Find nearest zone
  const nearestZone = findNearestZone(x, y, zones);
  
  if (nearestZone) {
    // Snap to zone
    openZonePopup({
      x: nearestZone.bounds.x,
      y: nearestZone.bounds.y,
      zoneId: nearestZone.id,
      zoneName: nearestZone.name
    });
  } else {
    // Custom placement
    openZonePopup({ x, y, zoneId: 'custom', zoneName: 'Custom' });
  }
};

// Render markers
const renderMarkers = (ctx: CanvasRenderingContext2D, markers: InjectionMarker[]) => {
  markers.forEach(marker => {
    const x = marker.position.x * canvas.width;
    const y = marker.position.y * canvas.height;
    
    // Draw circle
    ctx.beginPath();
    ctx.arc(x, y, 10, 0, 2 * Math.PI);
    ctx.fillStyle = getMarkerColor(marker);
    ctx.fill();
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Draw units label
    ctx.fillStyle = 'white';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(marker.units.toString(), x, y + 4);
  });
};
```

### Color Coding

```typescript
// By product
const PRODUCT_COLORS: Record<string, string> = {
  botox_cosmetic: '#3b82f6',    // Blue
  dysport: '#10b981',            // Green
  xeomin: '#8b5cf6',             // Purple
  jeuveau: '#f59e0b',            // Amber
};

// By units (gradient)
const getColorByUnits = (units: number): string => {
  if (units <= 5) return '#22c55e';      // Green (low)
  if (units <= 15) return '#eab308';     // Yellow (medium)
  return '#ef4444';                       // Red (high)
};
```

---

## Testing Checklist

### Unit Tests
- [ ] Zone snapping logic
- [ ] FHIR extension serialization
- [ ] Marker CRUD operations
- [ ] Coordinate normalization

### Integration Tests
- [ ] Create treatment workflow
- [ ] Save/load from FHIR
- [ ] Photo upload
- [ ] Role-based access

### User Acceptance Tests
- [ ] Provider can document treatment
- [ ] Coordinator can view read-only
- [ ] History displays correctly
- [ ] Works on tablet (iPad)
- [ ] Works on desktop

---

## Future Enhancements

1. **AI Suggestions**: Suggest units based on patient history
2. **Comparison Mode**: Side-by-side before/after
3. **Export**: PDF injection map for patient
4. **Analytics**: Average units per zone across all patients
5. **3D Face Model**: Optional 3D visualization
6. **Voice Input**: Dictate notes while marking

---

## References

- [FHIR R4 Extensions](https://hl7.org/fhir/R4/extensibility.html)
- [Medplum React Components](https://storybook.medplum.com/)
- [Canvas API](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API)

---

**Document Version**: 1.0
**Author**: OpenCode AI Assistant
**Stakeholders**: Melissa Knudson, RN
**Status**: Ready for Implementation

**Next Steps:**
1. Review and approve plan
2. Begin Phase 1 implementation
3. Create FHIR extensions
4. Build components
5. Integrate with BotoxTreatmentPage
