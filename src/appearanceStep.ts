type Vec = [number, number, number]
export const primitiveKinds = ['box','cylinder-z','cylinder-y'] as const
export type DraftPart = { name: string; kind: typeof primitiveKinds[number]; origin: Vec; size: Vec }
type Solid = { id: string; vertices: Vec[]; faces: number[][] }

export function parseDraftParts(value: unknown): DraftPart[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 24) throw new Error('请提供 1–24 个零件。')
  return value.map((part: DraftPart, index) => {
    const validVector = (input: unknown, min: number) => Array.isArray(input) && input.length === 3 &&
      input.every(n => typeof n === 'number' && Number.isFinite(n) && n >= min && n <= 2000)
    if (!part || typeof part.name !== 'string' || !part.name.trim() || part.name.length > 80 ||
        !primitiveKinds.includes(part.kind) || !validVector(part.origin,-2000) || !validVector(part.size,1)) {
      throw new Error(`零件 ${index+1} 的名称、形体或毫米参数无效。`)
    }
    return {name:part.name.trim(), kind:part.kind, origin:part.origin, size:part.size}
  })
}

function prism(id: string, loop: Vec[], offset: Vec): Solid {
  const n = loop.length
  const vertices = [...loop, ...loop.map(([x,y,z]): Vec => [x+offset[0],y+offset[1],z+offset[2]])]
  return {id, vertices, faces:[
    Array.from({length:n}, (_,i) => n-i-1),
    Array.from({length:n}, (_,i) => n+i),
    ...loop.map((_,i) => [i,(i+1)%n,(i+1)%n+n,i+n]),
  ]}
}

export function draftSolids(parts: DraftPart[]) {
  return parseDraftParts(parts).map(({origin:[x,y,z],size:[w,d,h],kind}, index) => {
    const id = `part-${String(index+1).padStart(2,'0')}`
    if (kind === 'box') return prism(id,[[x,y,z],[x+w,y,z],[x+w,y+d,z],[x,y+d,z]],[0,0,h])
    const vertical = kind === 'cylinder-z'
    const loop = Array.from({length:48}, (_,i): Vec => {
      const angle = 2*Math.PI*i/48
      const px = x+w/2*(1+Math.cos(angle))
      return vertical ? [px,y+d/2*(1+Math.sin(angle)),z] : [px,y,z+h/2*(1-Math.sin(angle))]
    })
    return prism(id,loop,vertical ? [0,0,h] : [0,d,0])
  })
}

export function writeAppearanceStep(solids: Solid[]) {
  const rows: string[] = []
  const add = (entity: string) => { rows.push('#'+(rows.length+1)+'='+entity+';'); return '#'+rows.length }
  const refList = (refs: string[]) => '(' + refs.join(',') + ')'
  const num = (n: number) => n.toFixed(8)
  const app = add("APPLICATION_CONTEXT('mechanical design')")
  add("APPLICATION_PROTOCOL_DEFINITION('international standard','config_control_design',1994,"+app+")")
  const productContext = add("MECHANICAL_CONTEXT('',"+app+",'mechanical')")
  const product = add("PRODUCT('appearance','Appearance draft','',("+productContext+"))")
  const formation = add("PRODUCT_DEFINITION_FORMATION_WITH_SPECIFIED_SOURCE('','',"+product+",.NOT_KNOWN.)")
  const context = add("PRODUCT_DEFINITION_CONTEXT('part definition',"+app+",'design')")
  const definition = add("PRODUCT_DEFINITION('design','',"+formation+","+context+")")
  const shape = add("PRODUCT_DEFINITION_SHAPE('','',"+definition+")")
  const length = add('(LENGTH_UNIT() NAMED_UNIT(*) SI_UNIT(.MILLI.,.METRE.))')
  const angle = add('(NAMED_UNIT(*) PLANE_ANGLE_UNIT() SI_UNIT($,.RADIAN.))')
  const solidAngle = add('(NAMED_UNIT(*) SI_UNIT($,.STERADIAN.) SOLID_ANGLE_UNIT())')
  const tolerance = add("UNCERTAINTY_MEASURE_WITH_UNIT(LENGTH_MEASURE(0.000001),"+length+",'distance_accuracy_value','')")
  const geometry = add("(GEOMETRIC_REPRESENTATION_CONTEXT(3) GLOBAL_UNCERTAINTY_ASSIGNED_CONTEXT(("+tolerance+")) GLOBAL_UNIT_ASSIGNED_CONTEXT(("+[length,angle,solidAngle].join(',')+")) REPRESENTATION_CONTEXT('',''))")
  const location = add("CARTESIAN_POINT('',(0.,0.,0.))")
  const axis = add("AXIS2_PLACEMENT_3D('',"+location+",$,$)")
  const bodies = solids.map(solid => {
    const vertices = solid.vertices.map(p => add("CARTESIAN_POINT('',("+p.map(num).join(',')+"))"))
    const faces = solid.faces.map(face => {
      const loop = add("POLY_LOOP('',"+refList(face.map(i=>vertices[i]))+")")
      const bounds = add("FACE_OUTER_BOUND('',"+loop+",.T.)")
      return add("FACE('',("+bounds+"))")
    })
    const shell = add("CLOSED_SHELL('',"+refList(faces)+")")
    return add("FACETED_BREP('"+solid.id+"',"+shell+")")
  })
  const representation = add("FACETED_BREP_SHAPE_REPRESENTATION('',"+refList([axis,...bodies])+","+geometry+")")
  add("SHAPE_DEFINITION_REPRESENTATION("+shape+","+representation+")")
  return [
    'ISO-10303-21;', 'HEADER;', "FILE_DESCRIPTION(('INNOLIT appearance draft'),'2;1');",
    "FILE_NAME('appearance.step','"+new Date().toISOString()+"',(''),(''),'INNOLIT','INNOLIT','');",
    "FILE_SCHEMA(('CONFIG_CONTROL_DESIGN'));", 'ENDSEC;', 'DATA;', ...rows, 'ENDSEC;', 'END-ISO-10303-21;', '',
  ].join('\n')
}
