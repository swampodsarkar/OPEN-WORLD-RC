export const CONFIG = {
  width: window.innerWidth,
  height: window.innerHeight,
  world: {
    size: 5000,
    half: 2500
  },
  road: {
    edgeHalf: 1500,
    width: 26,
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
    race: 'Porsche 911 GT3',
    'race-future': 'Tesla Cybertruck',
    'sedan-sports': 'Nissan Skyline GT-R',
    'hatchback-sports': 'Honda Civic Type R',
    'suv-luxury': 'BMW X5',
    sedan: 'Ford Mustang',
    suv: 'Toyota RAV4',
    truck: 'Ford F-150',
    police: 'Ford Crown Victoria Police',
    taxi: 'Chevrolet Suburban Taxi'
  }
};
