export const CONFIG = {
  width: window.innerWidth,
  height: window.innerHeight,
  world: {
    size: 2000,
    half: 1000
  },
  road: {
    outerHalf: 400,
    innerHalf: 280,
    barrierHeight: 3,
    barrierWidth: 1,
    laneWidth: 3.5
  },
  car: {
    maxSpeed: 50,
    acceleration: 30,
    braking: 40,
    friction: 0.97,
    steerSpeed: 2.5,
    boostMultiplier: 2
  },
  camera: {
    followHeight: 9,
    followDistance: 13,
    lerpSpeed: 0.1,
    minFov: 60,
    maxFov: 78
  },
  skyColor: 0x6699cc,
  groundColor: 0x3a7d3a,
  cars: {
    sedan: 'Ford Mustang',
    'sedan-sports': 'Nissan Skyline GT-R',
    suv: 'Toyota RAV4',
    'suv-luxury': 'BMW X5',
    taxi: 'Chevrolet Suburban Taxi',
    police: 'Ford Crown Victoria Police',
    ambulance: 'Ford F-150 Ambulance',
    race: 'Porsche 911 GT3',
    'race-future': 'Tesla Cybertruck',
    van: 'Mercedes-Benz Sprinter',
    truck: 'Ford F-150',
    'truck-flat': 'Chevrolet Silverado Flatbed',
    delivery: 'Ford Transit Delivery',
    'delivery-flat': 'Isuzu NPR Flatbed',
    firetruck: 'Pierce Arrow Fire Truck',
    'garbage-truck': 'Peterbilt 520 Garbage Truck',
    tractor: 'John Deere 6155M',
    'tractor-shovel': 'Caterpillar 420F Shovel',
    'hatchback-sports': 'Honda Civic Type R'
  }
};
