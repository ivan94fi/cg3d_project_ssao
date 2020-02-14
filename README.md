# cg3d_project_ssao
Implementation of SSAO for Computer Graphics &amp; 3D exam

## Description
This project gives an example implementation of Screen Space Ambient Occlusion (SSAO) 
as first described by [Crytek](https://www.crytek.com/) and implemented in their famous 
[Crysis](https://www.crytek.com/games/crysis) game, from 2007. The actual implementation
is closed source but a high level description of the latter from its developer can be found
[here](https://artis.inrialpes.fr/Membres/Olivier.Hoel/ssao/p97-mittring.pdf) at section `8.5.4.3`.

Occluded regions are areas in a 3D scene—geometries surrounded by many objects, corners, tight gaps between 
objects, creases, etc—which are traps for scattered ray lights: light cannot easily escape from these regions and as such they appear darker than unoccluded geometries.
The objective of Ambient Occlusion is thus to reproduce this shading of the ambient color in occluded regions to render the scene more realistic.

SSAO aims at approximating the effects of real Ambient Occlusion, obtained with 
global illumination, in a real time environment, where the exact calculation
would be infeasible. 

SSAO is done on a screen space basis (hence the name) using post processing and deferred rendering.
The steps involved are roughly the following:
* render geometry
* for each fragment in the geometry render target:
  * reconstruct the view space position of the fragment
  * sample some points in view space in an hemispheric volume oriented towards the surface normal at that fragment
  * for each sampled point, project the point in clip space and test whether the projected point is behind the actual geometry in that clip position:
    * if the sample is in front of the geometry, the geometry does not occlude the original fragment
    * if the sample is behind the geometry, the sample occludes the original fragment

With this algorithm we obtain a screen space map of values in [0,1], where 1 means no occlusion and 0 means maximum occlusion.
These values are then multiplied with the rendered geometry buffer, so as to attenuate the ambient color intensity by a factor proportional to the ambient occlusion map.
Thus, the occluded regions are darkened, as required.

This implementation is realized in Javascript with the aid of the 3D graphics library [three.js](https://threejs.org/), which in turns uses WebGL.

## Installation
The project requires Node.js and can be installed (together with dependencies)
with the following commands:
```shell
git clone git@github.com:ivan94fi/cg3d_project_ssao.git
cd cg3d_project_ssao
npm install
```

## Execution
After installation, the development server can be executed with
```shell
npm run dev
```
and the production server (using Express.js) with
```shell
npm run build
npm run start
```

## Online version
An online version of the project, hosted on Heroku, is accessible at [this link](https://cg3d-project-ssao.herokuapp.com/).
Please be patient on startup because the Heroku machine takes a while to fire up.

## Acknowledgments
The application code follows the structure of the [SSAO example in three.js](https://github.com/mrdoob/three.js/blob/master/examples/webgl_postprocessing_ssao.html),
while the realization of the SSAO shader is based on the material available in the following sources, which have been of great help:
* John Chapman:
  * <http://john-chapman-graphics.blogspot.com/2013/01/ssao-tutorial.html>
* LearnOpenGL:
  * <https://learnopengl.com/Advanced-Lighting/SSAO>
* Matt Pettineo: 
  * <https://mynameismjp.wordpress.com/2009/03/10/reconstructing-position-from-depth>
  * <https://mynameismjp.wordpress.com/2009/05/05/reconstructing-position-from-depth-continued/>
  * <https://mynameismjp.wordpress.com/2010/09/05/position-from-depth-3/>
* OGLdev: 
  * <http://ogldev.atspace.co.uk/www/tutorial46/tutorial45.html>
  * <http://ogldev.atspace.co.uk/www/tutorial46/tutorial46.html>
* Inigo Quilez:
  * <https://iquilezles.org/www/articles/ssao/ssao.htm>


