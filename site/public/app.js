// Demo page for ipyspeck / stspeck: the shared SpeckViewer driven by plain
// DOM controls. Structures load live from RCSB and AlphaFold DB.
(function () {
  "use strict";
  var S = window.Speck;
  var GALLERY = "https://raw.githubusercontent.com/denphi/speck/master/media/gallery/";

  // Same looks as ipyspeck's apply_preset(); each starts from "default".
  var PRESETS = {
    "default": {ao: 0.75, brightness: 0.5, atomShade: 0.5, bondShade: 0.5, cartoonShade: 0.2,
                surfaceShade: 0.1, outline: 0.0, outlineWidth: 1.0, outlineColor: "#000000",
                specular: 0.0, gloss: 0.5, metallic: 0.0, metallicAtoms: "all", shadows: 0.0,
                rim: 0.0, fog: 0.0, saturation: 1.0, tonemap: false, dofStrength: 0.0},
    matte: {ao: 0.9, brightness: 0.55},
    glossy: {specular: 0.6, gloss: 0.65, rim: 0.2, tonemap: true},
    toon: {ao: 0.3, outline: 1.0, outlineWidth: 1.5, atomShade: 0.3, cartoonShade: 0.1},
    cover: {ao: 1.0, brightness: 0.55, specular: 0.5, gloss: 0.6, shadows: 0.6, rim: 0.35, fog: 0.35,
            saturation: 1.15, tonemap: true, outline: 0.2, atomShade: 0.25, cartoonShade: 0.05},
    metal: {metallic: 1.0, metallicAtoms: "metals", gloss: 0.75, specular: 0.6, atomShade: 0.1, tonemap: true},
    glass: {surface: true, surfaceOpacity: 0.35, surfaceColor: "#eef2f8", specular: 0.4, gloss: 0.7, cartoon: true}
  };

  var SAMPLES = [
    {label: "AlphaFold RPP7", query: "Q8W3K0", preset: "cover", settings: {cartoon: true, cartoonColor: "plddt"}},
    {label: "Hemoglobin", query: "4HHB", preset: "glossy",
     settings: {cartoon: true, cartoonColor: "chain", surface: true, surfaceOpacity: 0.3, surfaceColor: "#eef2f8",
                highlight: {resName: "HEM"}, highlightScale: 1.3, shadows: 0.4}},
    {label: "Nucleosome", query: "1KX5", preset: "cover", settings: {cartoon: true, cartoonColor: "chain", ligands: false}},
    {label: "Spike", query: "6VXX", preset: "cover",
     settings: {surface: true, surfaceColor: "chain", surfaceResolution: 0.8}},
    {label: "GFP", query: "1EMA", preset: "glossy",
     settings: {cartoon: true, cartoonColor: "#3fbf66", highlight: {resName: "CRO"}, highlightScale: 2.0}},
    {label: "Ubiquitin", query: "1UBQ", preset: "glossy",
     settings: {surface: true, surfaceColor: "rainbow", shadows: 0.5}},
    {label: "Gold cluster", preset: "metal", data: "247\n\nAu     13.039823419999999     12.808387800000000     12.823100419999999\nAu     14.106025180000001     10.679636240000001     14.179695660000000\nAu     11.044783880000001     11.449406020000000     14.123961540000000\nAu     11.136579220000000     14.309975939999999     14.368438760000000\nAu     13.895705980000001     15.334157540000000     13.852859279999999\nAu     15.636367240000002     12.996428119999999     14.000823199999999\nAu     12.200740760000000     10.531321320000000     11.516889020000001\nAu     13.314824900000001     13.011346919999999     15.649572640000001\nAu     10.537725120000001     12.958167299999999     11.836336720000000\nAu     15.119902460000000     14.298941800000001     11.549833619999999\nAu     15.028701999999999     11.297233739999999     11.525418580000000\nAu     13.169072020000000     12.954808100000001     10.093539560000000\nAu     14.039370020000000     10.309995799999999     16.850720899999999\nAu     11.302736639999999     11.236406479999999     17.004957319999999\nAu     11.184774899999999     14.006075200000002     17.651862019999999\nAu     11.992604000000000     15.301646360000001     11.536888739999998\nAu     14.150435260000002     15.362976720000001     16.847713480000003\nAu     15.908077379999998     12.913240860000000     16.815481020000000\nAu     16.773757000000000     10.615281040000001     15.299311819999998\nAu      9.315207720000000     12.776114520000000     15.915448379999999\nAu     11.860028180000000     16.586535939999997     15.811216979999999\nAu     16.323994180000000     15.610071619999999     15.203691099999999\nAu     15.867002059999999      8.997207440000000     12.653964700000000\nAu     13.264042740000001      8.321371240000000     13.062831599999999\nAu     10.151830000000000      9.266276500000000     12.742837380000001\nAu     12.126648560000000      9.083672780000001     15.501371600000001\nAu      8.476727739999999     11.455192840000000     13.318611800000001\nAu     10.146392100000000     16.739120320000001     13.397370219999999\nAu     12.637684540000000     17.633696080000000     12.826730019999999\nAu     15.551694859999998     16.999698039999998     12.631739379999999\nAu     17.528956900000001     14.547007279999999     12.724635300000001\nAu     17.433816919999998     11.651176679999999     12.503822240000000\nAu     14.082008200000001      8.890383320000000     10.392590780000001\nAu      8.465880799999999     14.334362639999998     13.559029899999999\nAu      9.674396679999999     10.688009279999999     10.361147160000000\nAu      9.516212160000000     10.758762819999999      7.504812380000001\nAu      9.491785680000000     15.615748979999999      8.069195160000000\nAu     16.852188859999998     13.123292000000001      9.771925280000000\nAu     10.494427580000000     13.122431659999998      8.958533740000000\nAu     12.087056799999999     15.593050980000001      8.919846260000000\nAu     14.786308160000001     14.700080200000002      8.558145179999999\nAu     14.876698200000000     11.213385039999999      8.613419100000000\nAu     13.527052240000000     13.057765500000000     18.440960459999999\nAu     14.863230980000001      7.858639100000000     15.581491380000001\nAu     12.061523240000000     10.660087360000000      8.750634100000001\nAu      9.264195980000000      9.775149799999999     15.647199100000000\nAu     14.363211459999999     17.755272340000001     15.150683860000001\nAu     18.204572100000000     13.346813219999998     15.266396600000000\nAu     11.178688820000000      8.121282519999999     10.283462280000000\nAu      7.819322160000000     12.994281820000001     11.041207840000000\nAu     10.917334739999999     17.585030319999998     10.744356740000001\nAu     16.665514840000000     16.252212340000000     10.051942940000000\nAu      9.324959540000000     15.625784459999998     16.009806019999999\nAu     17.100065319999999     10.257777400000000      9.942154819999999\nAu     12.736456980000000     13.253075679999998      7.193759300000000\nAu     16.712354099999999     10.615591479999999     18.107299859999998\nAu      9.182398680000000     12.181582920000000     18.460568360000000\nAu     12.133165980000001     16.501177420000001     18.833141860000001\nAu     16.763189820000001     15.431077739999999     17.917964479999998\nAu     18.482953060000000      9.000034160000000     14.046686940000001\nAu     11.039948140000000      6.868476419999999     13.642481579999998\nAu      6.351747740000000     12.742910700000001     14.855305140000000\nAu     12.449667880000000      7.230496780000000     17.832390159999999\nAu     10.926690320000001     19.009866719999998     15.065133720000002\nAu     14.736684300000000      6.374420780000000     12.068372159999999\nAu      7.390783920000000      9.239324120000001     11.919912679999999\nAu      7.497635340000000     16.744022099999999     12.780854059999999\nAu     14.987437139999999     19.281000700000000     11.387132380000001\nAu     19.370113880000002     13.332546499999999     11.051224340000001\nAu     13.808168400000000      8.867958060000001      7.630148240000000\nAu     18.198152700000001     17.113536959999998     13.829132200000000\nAu      9.407763820000000     15.324454080000001     11.040897400000000\nAu     13.989706379999999     17.148306760000001     10.173193160000000\nAu     13.900520660000002     17.111199820000000      7.313302100000000\nAu      9.899253260000000     19.395467779999997     12.610649479999999\nAu     11.583364520000000     11.341433740000001     19.692591879999998\nAu      9.710112360000000     13.553536359999999     21.080023120000000\nAu     14.528896720000001     15.268616739999999     19.668516399999998\nAu     16.210585559999998     12.991450420000000     19.610288360000002\nAu     15.387225619999999      8.272464720000000     18.506350720000000\nAu     10.269315160000000      8.978249020000000     18.219401460000000\nAu     14.450996820000000     10.601446960000001     19.631142180000001\nAu      9.522008860000001     15.458781779999999     18.998566080000000\nAu     18.428226440000003     13.295265359999998     18.107885899999999\nAu     19.046060019999999     10.933767000000000     16.764832240000000\nAu     17.530277180000002      8.408944699999999     16.716745759999998\nAu     12.738780860000000      4.370489239999999     16.974906260000001\nAu     10.308982320000000      7.240400960000000     16.165801080000001\nAu      7.299297719999999     11.051067820000000     16.750871280000002\nAu     15.005291079999999     17.612946520000001     18.115971120000001\nAu      7.394776480000001     14.089648299999999     17.224721799999998\nAu     10.014750200000000     17.852421600000000     17.541269720000003\nAu     12.645812920000001     18.749875299999999     17.124778839999998\nAu     19.134345100000001     15.717644540000000     16.180342100000001\nAu     16.653381940000003      6.679902840000000     13.970331440000001\nAu     13.611502320000000      5.770387220000000     14.484397200000000\nAu      8.253753039999999      7.676050200000001     13.866625500000000\nAu      4.563473979999999     10.690937399999999     15.314998140000000\nAu      6.520530899999999     15.682271540000002     15.219160840000001\nAu     16.944425680000002     18.087670899999999     16.273183939999999\nAu      8.326093100000000     18.066129640000000     15.195211459999999\nAu     16.209591320000001     19.707315160000000     13.950439619999999\nAu     20.086666860000001     14.461542160000000     13.550735899999999\nAu     19.849915020000001     11.500291140000000     13.929575920000000\nAu     18.203707079999997      8.134349860000000     11.415418559999999\nAu     12.103501280000000      5.596092840000000     11.477094980000000\nAu      8.726831360000000      6.989954919999999     11.379983160000000\nAu     13.458248699999999     20.229239160000002     14.136571280000000\nAu      5.824994500000000     11.516631620000000     12.413076260000000\nAu     19.823578319999999      8.953283300000001      8.918741780000000\nAu     16.800891640000000     13.363023699999999      6.938159540000000\nAu     10.601456320000000     22.219121600000001     12.151783540000000\nAu     19.384353040000001     16.051663420000001     11.480358760000000\nAu     19.598360599999999     10.674601860000001     11.369152600000001\nAu     16.288509380000001      7.646101840000000      9.603732059999999\nAu     12.768792660000001      6.346497560000000      8.960019380000000\nAu      8.697416520000001      8.407335300000000      8.965255519999999\nAu      6.797984440000000     10.876497060000000      9.867724620000001\nAu     17.578453880000001     18.347129580000001     11.320692500000000\nAu      6.982779440000001     15.368143180000001     10.044680359999999\nAu     12.164836320000001     20.085681200000000     11.335236380000001\nAu     15.931543160000000     18.646012840000001      8.813956320000001\nAu     18.714248800000000     14.797063059999999      8.824478780000000\nAu     19.259977880000001     11.802296740000001      8.622613480000000\nAu     11.168200160000000      8.446574760000001      7.447677380000000\nAu      7.936001840000000     13.342172739999999      8.033803440000000\nAu      8.404184619999999     17.694616940000000      9.555847079999999\nAu     10.922264080000000     18.172465219999999      8.108186060000000\nAu     16.770255580000001     16.188182919999999      7.378982260000001\nAu     16.482638640000001      9.142010800000000      7.279507820000000\nAu      9.850818900000000     13.567047259999999      6.127539339999999\nAu     11.592718800000000     15.686102120000001      6.183091720000000\nAu     14.511308499999998     14.425972860000002      5.581820140000000\nAu     14.718405000000001     11.867594960000000      5.799696240000000\nAu     13.153171199999999     12.799080839999998     21.511005359999999\nAu     15.866146140000000      5.376712380000000     16.164293080000000\nAu     12.007154640000001     10.765542320000000      6.032723060000000\nAu      6.091819240000000      8.297361540000001     16.326606920000000\nAu     15.017037879999998     20.098270400000001     16.279437460000000\nAu     21.309804359999998     13.894095020000000     16.589768520000000\nAu      9.906057460000000      5.670948920000000      8.644610260000000\nAu      4.981369900000000     13.211238820000000      9.630275980000000\nAu      9.826256440000000     20.086995240000000      9.807254859999999\nAu     18.910402420000000     18.094642539999999      7.923172140000000\nAu      6.814942160000000     16.857007180000000     18.505767800000001\nAu      5.772922740000000     14.424667399999999     12.716445560000000\nAu     12.211542720000001     13.702351000000000      4.072038620000000\nS       9.110522200000000     22.318353720000001     10.422336860000000\nS      14.865696820000002      3.409562000000000     17.083041299999998\nS      12.189367579999999     15.969874959999999      3.849694420000000\nS      14.319914699999998     10.749139960000001     21.962681000000000\nS       9.859341700000000      6.776785860000000      6.482259940000000\nS      15.589818400000000     19.960605340000001     18.660783179999999\nS       5.286265140000000     10.062323440000000     17.510252760000000\nS       8.153317120000001     16.667644499999998     20.438635880000000\nS      20.112492399999997     16.158455300000000      7.410193960000000\nS      21.390520840000001      9.315082400000000     10.699342419999999\nS       3.778480680000000     14.247341159999998     11.301766579999999\nS      20.550006620000001     13.826214480000001     18.762242199999999\nS      22.300191160000001     14.293317740000001     14.563210999999999\nS      17.870727419999998     20.428068439999997     12.620086180000001\nS       8.603768940000000     11.637430739999999      5.426605340000000\nS      17.997446480000001      6.148516400000000     17.088404579999999\nS       7.859505940000001     19.981474240000001     13.743408119999998\nS       6.096033580000000     17.343995499999998      8.924771959999999\nS      17.601266020000001     20.064119659999999      7.733178180000000\nS      18.601381499999999      8.064085380000000      6.978406500000000\nS      10.438453220000000      4.844228740000000     16.819001680000000\nS      10.588233240000001      9.238028799999999     20.598524699999999\nS      11.128319800000000     19.716209240000001     18.714703799999999\nS      16.333594160000001     15.861889160000000      4.937316020000000\nS       3.739451040000000     10.707820240000000     13.194334140000002\nS       8.979876619999999      4.698098340000000     10.461880260000001\nS      13.875745779999999      6.410532440000000      6.895359899999999\nS       6.788104440000000      9.314853859999999      7.900278100000000\nS      18.526850420000002      6.085913860000000     12.599475200000001\nS       5.144759100000000     13.358453940000000     18.363912320000001\nS      19.194665619999999     18.107404379999998     16.917787120000000\nS      11.770779279999999     14.623271259999999     21.547871799999999\nS       7.818926960000001     12.265808359999999     20.361473860000000\nS       6.600626500000001      6.481149740000000     14.933095059999999\nS      12.298442260000000     11.400063220000000      3.791133320000000\nS      15.973794200000000     10.056388940000001      5.031101660000000\nS      22.409626979999999     17.115829900000001     10.053943380000000\nS      18.921962539999999     12.264373939999999      6.299057700000000\nS      12.448396480000000     22.339630300000000     13.519640420000000\nS      12.532392860000000     18.887277500000000      6.573670220000000\nS      12.616995559999999      4.022648500000000     13.078064739999999\nS      21.402471999999999     10.825800440000000     15.596773920000000\nS      15.827786260000002     14.338957359999998     21.739826420000000\nS      13.950394380000001     21.019322740000000     10.048097020000000\nS      13.899679299999999      6.801141880000000     19.480803680000001\nS       5.351096400000000     17.105815999999997     16.759402139999999\nS       5.698638400000000     12.580599979999999      7.491243760000000\nS      20.655509940000002     17.945209360000000     10.886724940000001\nS       5.292376440000000     17.588569440000001     12.735988200000000\nS      15.896883600000001      5.440165120000000     10.263948500000000\nH       7.948080140000000     21.875232860000001     11.082926920000000\nH      15.204347600000002      3.644606680000000     18.457504260000000\nH      13.576636060000000     16.007276220000001      4.190440020000000\nH      15.707326699999999     11.037108420000001     21.877264239999999\nH       8.608490800000000      7.337536700000000      6.612995740000001\nH      14.431670500000001     20.261963020000000     19.387990960000000\nH       8.588834280000000     17.958275139999998     20.158708440000002\nH       4.448457520000000     13.802266139999999     17.214642640000001\nH      21.317487359999998     16.293651659999998      8.069239360000001\nH      22.127289860000001     10.193362400000000      9.940900060000001\nH       3.284183500000000     13.019324240000001     11.787350640000000\nH      20.269198560000000     15.190271459999998     18.757590799999999\nH      22.573764460000000     15.606621940000000     14.802690240000000\nH      17.160093600000000     21.306620660000000     11.855809420000000\nH       9.468175600000000     11.134570719999999      4.462936140000000\nH      17.758382720000000      6.122228320000001     18.418831860000001\nH       6.986179460000001     19.399344379999999     12.789246600000000\nH       6.455809620000000     17.015421539999998      7.659317640000001\nH      18.189929159999998     20.690723819999999      8.867208220000000\nH      18.336398340000002      6.839400100000000      7.598033560000000\nH      10.130531320000001      5.150386280000000     18.126999020000000\nH      11.762061480000000      8.520661239999999     20.636494840000001\nH      10.486681140000000     20.667107500000000     17.903168140000002\nH      17.170023260000001     14.795000999999999      4.574025300000000\nH       4.043383500000000      9.415093479999999     12.898969980000000\nH      10.085872419999999      4.551892019999999     11.267985040000001\nH      12.762657700000000      6.487022620000000      6.039873320000000\nH       5.858152820000000      8.437403000000000      8.400688400000000\nH      19.587245339999999      6.531534620000000     13.428118860000000\nH       4.833012600000000     12.062878099999999     18.059472860000000\nH      19.093432799999999     17.830985120000001     18.293802539999998\nH      11.500198060000001     15.036945820000000     22.863939540000001\nH       7.107433060000000     13.305734519999998     19.900653500000001\nH       5.582217160000000      6.567726360000000     14.044544799999999\nH      13.667559619999999     11.042651100000000      3.888368120000000\nH      14.996889180000000      9.187786140000000      4.658672980000000\nH      22.884269720000002     18.210292360000000      9.322399840000001\nH      19.671391220000000     13.431530320000000      6.316714040000000\nH      11.731205200000000     22.684781080000000     14.626330420000000\nH      12.087900240000000     18.335499779999999      5.333280680000000\nH      13.827246940000002      3.587206220000000     12.618319999999999\nH      21.895966300000001     11.988139800000001     16.158261860000000\nH      17.011020259999999     15.113367619999998     21.683599600000001\nH      14.213526860000000     22.205040520000001     10.767471000000000\nH      14.263668120000002      5.479919120000000     19.097325000000001\nH       4.313850840000000     16.385467020000000     17.326069280000002\nH       5.248608560000000     13.757932499999999      6.843214559999999\nH      19.875038820000000     18.017433199999999      9.682071100000000\nH       5.079612460000000     17.343160900000001     11.365946800000000\nH      14.786332600000000      5.289413479999999      9.345354720000000\n", settings: {shadows: 0.6}},
    {label: "Caffeine", preset: "toon", data: "24\nCaffeine\nH      -3.3804130    -1.1272367     0.5733036\nN       0.9668296    -1.0737425    -0.8198227\nC       0.0567293     0.8527195     0.3923156\nN      -1.3751742    -1.0212243    -0.0570552\nC      -1.2615018     0.2590713     0.5234135\nC      -0.3068337    -1.6836331    -0.7169344\nC       1.1394235     0.1874122    -0.2700900\nN       0.5602627     2.0839095     0.8251589\nO      -0.4926797    -2.8180554    -1.2094732\nC      -2.6328073    -1.7303959    -0.0060953\nO      -2.2301338     0.7988624     1.0899730\nH       2.5496990     2.9734977     0.6229590\nC       2.0527432    -1.7360887    -1.4931279\nH      -2.4807715    -2.7269528     0.4882631\nH      -3.0089039    -1.9025254    -1.0498023\nH       2.9176101    -1.8481516    -0.7857866\nH       2.3787863    -1.1211917    -2.3743655\nH       1.7189877    -2.7489920    -1.8439205\nC      -0.1518450     3.0970046     1.5348347\nC       1.8934096     2.1181245     0.4193193\nN       2.2861252     0.9968439    -0.2440298\nH      -0.1687028     4.0436553     0.9301094\nH       0.3535322     3.2979060     2.5177747\nH      -1.2074498     2.7537592     1.7203047\n", settings: {}}
  ];

  var RCSB = "https://files.rcsb.org/download/";
  var SCENES = {};

  // Default element colors, to undo a scene's custom colors.
  var DEFAULT_COLORS = {};
  Object.keys(S.elements).forEach(function (k) {
    if (isNaN(k)) DEFAULT_COLORS[k] = S.elements[k].color.slice();
  });
  var customColors = false;

  // --- viewer state (the "host" of SpeckViewer) ------------------------------
  function freshState() {
    var s = {data: "", toolbar: true, camera: {}};
    for (var k in S.VIEW_DEFAULTS) s[k] = JSON.parse(JSON.stringify(S.VIEW_DEFAULTS[k]));
    return s;
  }
  var state = freshState();
  var stage = document.querySelector(".stage");
  var controls = [].slice.call(document.querySelectorAll("[data-trait]"));

  var viewer = new S.SpeckViewer(document.getElementById("viewer"), {
    get: function (trait) { return state[trait]; },
    set: function (changes) { apply(changes); },   // toolbar buttons
    cameraChanged: function (camera) { state.camera = camera; }
  });

  function apply(changes) {
    for (var k in changes) {
      state[k] = changes[k];
      if (k in S.VIEW_DEFAULTS) viewer.setTrait(k, changes[k]);
    }
    syncControls();
  }

  function syncControls() {
    controls.forEach(function (el) {
      var v = state[el.dataset.trait];
      if (el.type === "checkbox") el.checked = !!v;
      else el.value = v;
      var out = el.parentNode.querySelector(".v");
      if (out) out.textContent = Number(v).toFixed(2);
    });
    document.getElementById("focusLigands").checked = !!(state.dofFocus && state.dofFocus.ligands);
  }

  controls.forEach(function (el) {
    el.addEventListener(el.type === "range" ? "input" : "change", function () {
      var change = {};
      change[el.dataset.trait] = el.type === "checkbox" ? el.checked : el.type === "range" ? parseFloat(el.value) : el.value;
      apply(change);
      markPreset(null);
    });
  });
  document.getElementById("focusLigands").addEventListener("change", function (e) {
    apply({dofFocus: e.target.checked ? {ligands: true} : {},
           dofStrength: e.target.checked && state.dofStrength === 0 ? 1.0 : state.dofStrength});
  });

  // --- presets ------------------------------------------------------------
  var presetBox = document.getElementById("presets");
  Object.keys(PRESETS).forEach(function (name) {
    var b = document.createElement("button");
    b.textContent = name;
    b.dataset.preset = name;
    b.addEventListener("click", function () {
      var values = Object.assign({}, PRESETS["default"], PRESETS[name]);
      apply(values);
      markPreset(name);
    });
    presetBox.appendChild(b);
  });
  function markPreset(name) {
    [].forEach.call(presetBox.children, function (b) { b.classList.toggle("active", b.dataset.preset === name); });
  }

  // --- loading ------------------------------------------------------------
  var info = document.getElementById("info");
  // Only the most recently started load is shown (a slow download must not
  // replace a structure picked after it).
  var loadTicket = 0;
  var loadingEl = document.getElementById("loading");

  function fetchText(url) {
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error(r.status + " for " + url);
      return r.text();
    });
  }

  function fetchStructure(query) {
    query = query.trim();
    if (/^[0-9][A-Za-z0-9]{3}$/.test(query)) {
      return fetchText("https://files.rcsb.org/download/" + query.toUpperCase() + ".pdb")
        .then(function (t) { return {text: t, source: "RCSB " + query.toUpperCase()}; });
    }
    return fetch("https://alphafold.ebi.ac.uk/api/prediction/" + encodeURIComponent(query.toUpperCase()))
      .then(function (r) { if (!r.ok) throw new Error("no AlphaFold model for " + query); return r.json(); })
      .then(function (entries) { return fetchText(entries[0].pdbUrl); })
      .then(function (t) { return {text: t, source: "AlphaFold " + query.toUpperCase()}; });
  }

  function resetScene() {
    if (customColors) {
      viewer.setAtomsColor(DEFAULT_COLORS);
      customColors = false;
    }
    stage.style.background = "";
  }

  function show(text, source, preset, settings) {
    resetScene();
    var next = freshState();
    Object.assign(next, PRESETS["default"], PRESETS[preset || "default"], settings || {});
    next.data = text;
    state = next;
    for (var k in S.VIEW_DEFAULTS) viewer.setTrait(k, state[k]);
    viewer.updateToolbar();
    viewer.loadStructure();
    syncControls();
    markPreset(preset || null);
    var atoms = (text.match(/^(ATOM  |HETATM)/gm) || []).length || parseInt(text) || 0;
    info.textContent = source + " · " + atoms.toLocaleString() + " atoms";
  }

  function load(sample, button) {
    [].forEach.call(document.querySelectorAll("#samples button"), function (b) { b.classList.toggle("active", b === button); });
    if (sample.query) history.replaceState(null, "", "?q=" + encodeURIComponent(sample.query.trim()));
    loadingEl.style.display = "block";
    var ticket = ++loadTicket;
    var ready = sample.data ? Promise.resolve({text: sample.data, source: sample.label}) : fetchStructure(sample.query);
    return ready.then(function (r) {
      if (ticket !== loadTicket) return;
      var isPDB = /^(ATOM  |HETATM)/m.test(r.text);
      var settings = Object.assign({}, sample.settings || {});
      if (isPDB && !("cartoon" in settings) && !("surface" in settings)) settings.cartoon = true;
      if (/^AlphaFold/.test(r.source) && !settings.cartoonColor) settings.cartoonColor = "plddt";
      show(r.text, r.source, sample.preset, settings);
    }).catch(function (e) {
      if (ticket === loadTicket) info.textContent = "Could not load: " + e.message;
    }).then(function () { if (ticket === loadTicket) loadingEl.style.display = "none"; });
  }

  var samplesBox = document.getElementById("samples");
  SAMPLES.forEach(function (s, i) {
    var b = document.createElement("button");
    b.textContent = s.label;
    b.addEventListener("click", function () { load(s, b); });
    samplesBox.appendChild(b);
    if (i === 0) s.button = b;
  });

  var query = document.getElementById("query");
  function loadQuery() { if (query.value.trim()) load({query: query.value, preset: "glossy"}, null); }
  document.getElementById("go").addEventListener("click", loadQuery);
  query.addEventListener("keydown", function (e) { if (e.key === "Enter") loadQuery(); });

  // Drop a PDB / XYZ file on the viewer.
  stage.addEventListener("dragover", function (e) { e.preventDefault(); });
  stage.addEventListener("drop", function (e) {
    e.preventDefault();
    var f = e.dataTransfer.files[0];
    if (!f) return;
    var ticket = ++loadTicket;
    f.text().then(function (t) {
      if (ticket !== loadTicket) return;
      var isPDB = /^(ATOM  |HETATM)/m.test(t);
      show(t, f.name, "glossy", isPDB ? {cartoon: true} : {});
    });
  });

  // --- export -------------------------------------------------------------
  document.getElementById("export").addEventListener("click", function () {
    var width = parseInt(document.getElementById("exportSize").value);
    var button = this;
    button.disabled = true;
    viewer.renderImage({width: width, transparent: false, background: "#ffffff"}).then(function (image) {
      var url = URL.createObjectURL(new Blob([image.png], {type: "image/png"}));
      var a = document.createElement("a");
      a.href = url;
      a.download = "ipyspeck.png";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    }).catch(function (e) { info.textContent = "Export failed: " + e.message; })
      .then(function () { button.disabled = false; });
  });

  // --- gallery scenes ------------------------------------------------------
  // A scene's camera was recorded for an image of scene.size; the viewer has
  // another aspect, so fit the image's visible area inside the viewer. (The
  // canvas shows the bottom-left part of a square frame of side max(w, h).)
  function fitCamera(camera, size) {
    var el = document.getElementById("viewer");
    var cw = el.clientWidth, ch = el.clientHeight, iw = size[0], ih = size[1];
    var mi = Math.max(iw, ih), mc = Math.max(cw, ch), wi = 1 / camera.zoom;
    var width = wi * iw / mi, height = wi * ih / mi;
    var cx = camera.translation[0] - wi / 2 + width / 2;
    var cy = camera.translation[1] - wi / 2 + height / 2;
    var wc = Math.max(width * mc / cw, height * mc / ch);
    return {rotation: camera.rotation, zoom: 1 / wc,
            translation: [cx - wc * cw / mc / 2 + wc / 2, cy - wc * ch / mc / 2 + wc / 2]};
  }

  function sceneText(source) {
    if (source.alphafold) return fetchStructure(source.alphafold).then(function (r) { return r.text; });
    if (source.pdb) {
      return fetchText(RCSB + source.pdb + ".pdb").then(function (t) {
        if (!source.chains) return t;
        return t.split("\n").filter(function (l) {
          return /^(ATOM  |HETATM)/.test(l) && source.chains.indexOf(l.charAt(21)) >= 0;
        }).join("\n") + "\nEND\n";
      });
    }
    return fetchText(source.file);
  }

  function loadScene(name) {
    var sc = SCENES[name];
    if (!sc) return;
    [].forEach.call(document.querySelectorAll("#samples button"), function (b) { b.classList.remove("active"); });
    history.replaceState(null, "", "?example=" + name);
    loadingEl.style.display = "block";
    var ticket = ++loadTicket;
    sceneText(sc.source).then(function (text) {
      if (ticket !== loadTicket) return;
      resetScene();
      var next = freshState();
      Object.assign(next, sc.settings);
      next.data = text;
      next.camera = fitCamera(sc.camera, sc.size);
      state = next;
      for (var k in S.VIEW_DEFAULTS) viewer.setTrait(k, state[k]);
      viewer.updateToolbar();
      viewer.loadStructure();
      if (Object.keys(sc.colors).length) {
        viewer.setAtomsColor(sc.colors);
        customColors = true;
      }
      var bg = sc.background;
      stage.style.background = "radial-gradient(ellipse at 50% 42%, rgb(" + bg[0].join(",") + ") 0%, rgb(" +
                               bg[1].join(",") + ") 100%)";
      syncControls();
      markPreset(null);
      var atoms = (text.match(/^(ATOM  |HETATM)/gm) || []).length || parseInt(text) || 0;
      info.textContent = /atoms/.test(sc.caption) ? sc.caption : sc.caption + " · " + atoms.toLocaleString() + " atoms";
    }).catch(function (e) {
      if (ticket === loadTicket) info.textContent = "Could not load: " + e.message;
    }).then(function () { if (ticket === loadTicket) loadingEl.style.display = "none"; });
  }

  var galleryBox = document.getElementById("galleryGroups");
  function buildGallery() {
    var groups = [];
    Object.keys(SCENES).forEach(function (name) {
      var g = SCENES[name].group;
      if (groups.indexOf(g) < 0) groups.push(g);
    });
    groups.forEach(function (g) {
      var h = document.createElement("h3");
      h.textContent = g;
      var grid = document.createElement("div");
      grid.className = "grid";
      Object.keys(SCENES).filter(function (n) { return SCENES[n].group === g; }).forEach(function (name) {
        var fig = document.createElement("figure");
        fig.title = "Load this scene in the viewer";
        var img = document.createElement("img");
        img.loading = "lazy";
        img.src = GALLERY + name + ".jpg";
        img.alt = SCENES[name].caption;
        var cap = document.createElement("figcaption");
        cap.textContent = SCENES[name].caption;
        fig.appendChild(img);
        fig.appendChild(cap);
        fig.addEventListener("click", function () {
          window.scrollTo({top: 0, behavior: "smooth"});
          loadScene(name);
        });
        grid.appendChild(fig);
      });
      galleryBox.appendChild(h);
      galleryBox.appendChild(grid);
    });
  }

  syncControls();
  var params = new URLSearchParams(location.search);
  fetch("scenes.json").then(function (r) { return r.json(); }).then(function (scenes) {
    SCENES = scenes;
    buildGallery();
    if (params.get("example") && SCENES[params.get("example")]) loadScene(params.get("example"));
  });
  if (params.get("q")) { query.value = params.get("q"); loadQuery(); }
  else if (!params.get("example")) load(SAMPLES[0], SAMPLES[0].button);
})();
