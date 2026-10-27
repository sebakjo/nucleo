import { Body, Button, Container, Head, Hr, Html, Preview, Section, Text } from '@react-email/components'
import type { Contenido } from './contenido'

// Mismos tokens que la app (DESIGN.md), en estilos en línea porque los clientes de email no leen CSS externo.
const c = {
  cal: '#F5F7F6',
  superficie: '#FFFFFF',
  linea: '#D6DDDA',
  grafito: '#1F2A33',
  grafito2: '#55626B',
  eucalipto: '#2E5E4E',
  rosa: '#E7B4A6',
}
const fuente = "Onest, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"

/** Los 6 carriles del logo, con el tuyo en rosa. */
function Logo() {
  return (
    <table role="presentation" cellPadding={0} cellSpacing={0} style={{ marginBottom: 24 }}>
      <tbody>
        <tr>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <td key={i} style={{ paddingRight: 3 }}>
              <div
                style={{
                  width: 5,
                  height: 18,
                  borderRadius: 2,
                  background: i === 3 ? c.rosa : c.eucalipto,
                }}
              />
            </td>
          ))}
          <td style={{ paddingLeft: 8, fontFamily: fuente, fontWeight: 800, fontSize: 18, color: c.grafito }}>
            núcleo
          </td>
        </tr>
      </tbody>
    </table>
  )
}

export function EmailNucleo({ contenido }: { contenido: Contenido }) {
  return (
    <Html lang="es">
      <Head />
      <Preview>{contenido.previa}</Preview>
      <Body style={{ background: c.cal, margin: 0, padding: '32px 0', fontFamily: fuente, color: c.grafito }}>
        <Container style={{ maxWidth: 520, padding: '0 16px' }}>
          <Logo />
          <Section
            style={{
              background: c.superficie,
              border: `1px solid ${c.linea}`,
              borderRadius: 6,
              padding: '28px 28px 24px',
            }}
          >
            <Text style={{ fontSize: 22, lineHeight: '28px', fontWeight: 700, margin: '0 0 16px' }}>
              {contenido.titulo}
            </Text>
            {contenido.parrafos.map((p, i) => (
              <Text key={i} style={{ fontSize: 16, lineHeight: '24px', margin: '0 0 12px' }}>
                {p}
              </Text>
            ))}
            {contenido.detalle.length > 0 && (
              <>
                <Hr style={{ borderColor: c.linea, margin: '20px 0' }} />
                <table role="presentation" width="100%" cellPadding={0} cellSpacing={0}>
                  <tbody>
                    {contenido.detalle.map(([k, v]) => (
                      <tr key={k}>
                        <td style={{ fontSize: 14, color: c.grafito2, padding: '4px 0', width: '40%' }}>
                          {k}
                        </td>
                        <td
                          style={{
                            fontSize: 14,
                            fontWeight: 600,
                            padding: '4px 0',
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          {v}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
            {contenido.accion && (
              <Button
                href={contenido.accion.url}
                style={{
                  marginTop: 24,
                  background: c.eucalipto,
                  color: '#FFFFFF',
                  borderRadius: 8,
                  padding: '12px 20px',
                  fontSize: 15,
                  fontWeight: 600,
                  textDecoration: 'none',
                }}
              >
                {contenido.accion.texto}
              </Button>
            )}
          </Section>
          <Text style={{ fontSize: 12, lineHeight: '18px', color: c.grafito2, margin: '16px 0 0' }}>
            Núcleo, pilates reformer en Buenos Aires. Proyecto de demostración: los pagos funcionan en modo de
            prueba.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}
