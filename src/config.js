export const CONFIG = {
  width: window.innerWidth,
  height: window.innerHeight,
  world: {
    size: 1000,
    half: 500
  },
  road: {
    outerHalf: 300,
    innerHalf: 220,
    barrierHeight: 3,
    barrierWidth: 1
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
    followHeight: 22,
    followDistance: 15,
    lerpSpeed: 0.1,
    minFov: 60,
    maxFov: 75
  },
  skyColor: 0x6699cc,
  groundColor: 0x3a7d3a
};
