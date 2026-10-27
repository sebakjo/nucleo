'use client'

import Image from 'next/image'
import { Slider } from 'radix-ui'
import { useState } from 'react'
import antes from '../../../public/caso/antes.jpg'
import despues from '../../../public/caso/despues.jpg'

/** Antes y después sobre la misma captura: se arrastra la división (o se usan las flechas). */
export function Comparador() {
  const [corte, setCorte] = useState(50)
  return (
    <figure>
      <div className="relative overflow-hidden rounded-bloque border border-linea bg-superficie select-none">
        <Image
          src={despues}
          alt="Horarios de Núcleo en producción: grilla semanal con seis carriles por clase."
          sizes="(min-width: 1200px) 1136px, 100vw"
          placeholder="blur"
          className="block h-auto w-full"
          priority
        />
        <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - corte}% 0 0)` }}>
          <Image
            src={antes}
            alt="El prototipo: portada con degradé violeta, emojis y tarjetas de clases."
            sizes="(min-width: 1200px) 1136px, 100vw"
            placeholder="blur"
            className="block h-auto w-full"
          />
        </div>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 w-0.5 bg-superficie"
          style={{ left: `${corte}%` }}
        />
        <span className="pointer-events-none absolute bottom-3 left-3 rounded-[4px] bg-grafito/85 px-2 py-1 text-leyenda font-semibold text-white">
          Prototipo
        </span>
        <span className="pointer-events-none absolute right-3 bottom-3 rounded-[4px] bg-grafito/85 px-2 py-1 text-leyenda font-semibold text-white">
          Producción
        </span>
        <Slider.Root
          value={[corte]}
          onValueChange={([v]) => setCorte(v ?? 50)}
          min={0}
          max={100}
          step={1}
          className="absolute inset-0 flex touch-none items-center"
        >
          <Slider.Track className="relative h-full grow">
            <Slider.Range className="absolute h-full" />
          </Slider.Track>
          <Slider.Thumb
            aria-label="Comparar el prototipo con la versión en producción"
            aria-valuetext={`${corte} % prototipo, ${100 - corte} % producción`}
            className="grid h-11 w-11 cursor-ew-resize place-items-center rounded-full border border-linea bg-superficie text-grafito shadow-[0_1px_2px_rgb(31_42_51/0.2)]"
          >
            <svg viewBox="0 0 20 20" className="h-5 w-5" aria-hidden="true">
              <path
                d="M7 5 2 10l5 5M13 5l5 5-5 5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Slider.Thumb>
        </Slider.Root>
      </div>
      <figcaption className="mt-2 text-chico text-grafito-2">
        La misma semana de clases, a la misma hora. Arrastrá la división o usá las flechas del teclado.
      </figcaption>
    </figure>
  )
}
