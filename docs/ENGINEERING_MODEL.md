# Engineering model

## State and units

The simulation uses **millimetres of water over a zone area** for root-zone
storage. This is convenient because 1 mm over 1 m² equals 1 litre. Each zone
has:

- `area_m2`: surface area receiving irrigation and rainfall.
- `root_zone_depth_mm`: documented physical depth represented by the zone.
- `field_capacity_mm`: maximum modelled root-zone storage before drainage.
- `wilting_point_mm`: lower storage reference used for the display mapping.
- `moisture_percent`: a relative storage estimate from 0% at the wilting point
  to 100% at field capacity.

The displayed percentage is **not volumetric water content**. Volumetric water
content requires soil-specific calibration and a measurement method that this
project does not currently provide.

## Water balance

For each time step:

```text
storage_next = storage_previous
             + retained_irrigation
             + rainfall
             - evapotranspiration
             - drainage
```

Storage is clamped to zero and field capacity. Positive excess after
evapotranspiration is reported as drainage. Pump delivery and root-zone
retention remain separate: a 2 L/min pump running for 30 seconds delivers 1 L,
but an efficiency of 75% retains 0.75 L in the root zone.

## Sensor model

The default hardware assumption is an ESP32-style 12-bit ADC with a nominal
3.3 V reference, but the calibration record stores ADC resolution and
reference voltage. A calibration contains:

- `wetRaw`: measured raw endpoint for the wet reference.
- `dryRaw`: measured raw endpoint for the dry reference.
- `adcBits`: board ADC resolution.
- `referenceVoltageV`: voltage scale used for the voltage estimate.

The mapping is linear between the two measured endpoints and is clamped outside
the range. Reversed sensor orientation is supported. This is a normalized
sensor-equivalent percentage, not a universal soil measurement.

## Drying and environment

The current ET proxy increases with temperature, solar factor, wind factor, and
daylight, and decreases as relative humidity rises. It is intentionally a
small, transparent demonstration model. It is not a Penman-Monteith
implementation and must be calibrated against local observations before
physical deployment.

## Limitations

- Defaults are engineering assumptions, not measured campus-garden data.
- Soil type is stored as a configuration label; it does not yet load a
  laboratory-derived hydraulic curve.
- The pump and reservoir are software abstractions until hardware feedback is
  connected.
- A successful API response does not prove that water physically moved.
- Physical validation, water-saving claims, and crop-specific recommendations
  require field measurements outside this repository.